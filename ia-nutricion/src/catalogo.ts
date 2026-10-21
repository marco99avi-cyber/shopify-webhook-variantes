/**
 * Índice del catálogo en memoria: búsqueda por nombre y filtros por criterios nutricionales.
 *
 * Pensado para el arranque en frío de un Worker: al cargar solo se indexan títulos (barato).
 * Las fichas completas se calculan al consultarlas (~0,2 ms cada una) y los filtros usan
 * «hechos» compactos que el script de catálogo ya trae precalculados. Si esos hechos son de
 * otra versión del motor, se recalculan solos.
 */

import { type AlergenoId } from './conocimiento/alergenos.ts';
import { crearFicha, type EstadoAzucarAnadido, type Ficha, type ProductoCrudo, type VeredictoGluten } from './ficha.ts';
import { normalizar, singular, tokensDeBusqueda } from './texto.ts';

/** Súbelo cuando cambie la lógica de veredictos: invalida los hechos precalculados. */
export const VERSION_MOTOR = '1';

/** Lo mínimo para filtrar sin calcular la ficha entera. Claves cortas: viaja en el JSON. */
export interface Hechos {
  /** Veredicto de gluten. */
  g: VeredictoGluten;
  /** Alérgenos: «soja» = contiene, «leche?» = puede contener. */
  al: string[];
  /** Azúcar añadido. */
  az: EstadoAzucarAnadido;
  /** Vegano. */
  v: Ficha['vegano']['estado'];
  /** Alérgenos pendientes de confirmar. */
  pa: boolean;
  /** Falta el campo de alérgenos. */
  fa: boolean;
  /** Trazas genéricas. */
  tg: boolean;
  /** Por 100 g de producto sólido: [kcal, grasas, azúcares, fibra, proteínas, sal]; null si no hay o es por 100 ml. */
  n: Array<number | null> | null;
}

export interface ProductoConHechos extends ProductoCrudo {
  hechos?: Hechos;
}

export interface DatosCatalogo {
  generado?: string | null;
  tienda?: string | null;
  version?: string | null;
  productos: ProductoConHechos[];
}

/** Nombres populares → el token que usa el catálogo. */
const SINONIMOS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({
    linaza: 'lino',
    ajonjoli: 'sesamo',
    alforfon: 'sarraceno',
    mani: 'cacahuete',
    quinua: 'quinoa',
    frijol: 'alubia',
    judia: 'alubia',
    poroto: 'alubia',
    habichuela: 'alubia',
    orejon: 'albaricoque',
    spirulina: 'espirulina',
    yerba: 'hierba',
    cuscus: 'cous',
    couscous: 'cous',
    soya: 'soja',
    stevia: 'estevia',
    ceilan: 'ceylan',
    tahini: 'sesamo',
    tahin: 'sesamo',
  }).map(([k, v]) => [singular(normalizar(k)), singular(normalizar(v))]),
);

// Object.hasOwn: que «constructor» o «__proto__» escritos por un cliente no lean el prototipo.
const canon = (t: string): string => (Object.hasOwn(SINONIMOS, t) ? SINONIMOS[t] : t);
const tokensCanon = (texto: string): string[] => tokensDeBusqueda(texto).map(canon);

export function hechosDe(f: Ficha): Hechos {
  const n = f.nutricion;
  return {
    g: f.gluten.veredicto,
    al: f.alergenos.map((a) => (a.estado === 'contiene' ? a.id : `${a.id}?`)),
    az: f.azucar.anadido,
    v: f.vegano.estado,
    pa: f.deteccion.alergenos.pendiente,
    fa: f.datosQueFaltan.includes('alérgenos'),
    tg: f.trazasGenericas,
    n: n && n.base !== 'bebida_preparada' ? [n.kcal, n.grasas, n.azucares, n.fibra, n.proteinas, n.sal] : null,
  };
}

function hechosValidos(h: unknown): h is Hechos {
  if (!h || typeof h !== 'object') return false;
  const x = h as Partial<Hechos>;
  return (
    typeof x.g === 'string' &&
    Array.isArray(x.al) &&
    typeof x.az === 'string' &&
    typeof x.v === 'string' &&
    typeof x.pa === 'boolean' &&
    typeof x.fa === 'boolean' &&
    typeof x.tg === 'boolean' &&
    (x.n === null || (Array.isArray(x.n) && x.n.length === 6))
  );
}

interface Entrada {
  producto: ProductoConHechos;
  titulo: string[];
  extra: Set<string>;
  tipo: string[];
  ficha?: Ficha;
  hechos?: Hechos;
}

export interface Resultado {
  ficha: Ficha;
  puntuacion: number;
}

export type Orden = 'relevancia' | 'mas_proteina' | 'mas_fibra' | 'menos_azucar' | 'menos_kcal' | 'menos_sal';

export interface Criterios {
  texto: string | null;
  categoria: string | null;
  excluirAlergenos: AlergenoId[];
  sinGlutenEnIngredientes: boolean;
  sinAzucarAnadido: boolean;
  vegano: boolean;
  maxAzucares: number | null;
  minProteinas: number | null;
  minFibra: number | null;
  maxKcal: number | null;
  maxSal: number | null;
  maxGrasas: number | null;
  orden: Orden;
  limite: number;
}

export interface Catalogo {
  /** Todas las fichas (las calcula todas: para auditoría y scripts, no para cada petición). */
  readonly fichas: readonly Ficha[];
  readonly total: number;
  readonly categorias: readonly string[];
  readonly generado: string | null;
  porHandle(handle: string): Ficha | undefined;
  buscar(consulta: string, max?: number): Resultado[];
  /**
   * Búsqueda estricta para recetas: solo productos que SON ese ingrediente («cacao desgrasado»
   * → «Cacao puro en polvo», pero nunca «leche en polvo» → «Cobertura de chocolate con leche»
   * ni «harina de arroz» → «Harina de trigo»).
   */
  buscarIngrediente(ingrediente: string, max?: number): Resultado[];
  filtrar(c: Criterios): { total: number; resultados: Resultado[] };
  /** Hechos de todos los productos, para que el script de catálogo los guarde precalculados. */
  hechos(): Array<{ handle: string; hechos: Hechos }>;
}

/** Palabras de proceso o formato que no cambian qué ingrediente es. */
const PROCESADO = new Set(
  [
    'desgrasado', 'desgrasada', 'desnatado', 'desnatada', 'semidesnatada', 'entero', 'entera', 'polvo', 'tostado',
    'tostada', 'crudo', 'cruda', 'pelado', 'pelada', 'molido', 'molida', 'natural', 'ecologico', 'ecologica', 'eco',
    'integral', 'refinado', 'refinada', 'virgen', 'extra', 'puro', 'pura', 'deshidratado', 'deshidratada', 'seco',
    'seca', 'troceado', 'troceada', 'laminado', 'laminada', 'picado', 'picada', 'rallado', 'rallada', 'granulado',
    'granulada', 'escama', 'frito', 'frita', 'salado', 'salada', 'fresco', 'fresca', 'bio', 'grano', 'blanco',
    'blanca', 'dorado', 'dorada', 'marron', 'negro', 'negra', 'rojo', 'roja', 'verde',
  ].map((t) => singular(normalizar(t))),
);

/** Primeras palabras de título que describen el formato, no el ingrediente. */
const PREFIJOS_FORMATO = new Set(['cobertura'].map((t) => singular(t)));

const ETIQUETAS_INTERNAS = /^(ag-|ia-|bf-|revisar)/;

function coincide(q: string, t: string): boolean {
  if (q === t) return true;
  // Prefijos razonables: «almendr» <-> «almendra», «chocolat» <-> «chocolate».
  return q.length >= 5 && t.length >= 5 && (t.startsWith(q) || q.startsWith(t));
}

function puntuar(q: readonly string[], e: Entrada): number {
  if (q.length === 0) return 0;
  let enTitulo = 0;
  let enExtra = 0;
  for (const t of q) {
    if (e.titulo.some((x) => coincide(t, x))) enTitulo++;
    else for (const x of e.extra) if (coincide(t, x)) { enExtra++; break; }
  }
  const cobertura = (enTitulo + enExtra * 0.5) / q.length;
  if (cobertura < 0.5) return 0;
  const precision = e.titulo.length ? enTitulo / e.titulo.length : 0;
  const principal = e.titulo[0] !== undefined && coincide(q[0], e.titulo[0]) ? 0.1 : 0;
  return Math.round((cobertura * 0.7 + precision * 0.3 + principal) * 1000) / 1000;
}

const ESTADOS_SIN_GLUTEN: readonly VeredictoGluten[] = ['sin_gluten_en_ingredientes', 'declara_sin_gluten'];

export function crearCatalogo(datos: DatosCatalogo): Catalogo {
  if (!datos || !Array.isArray(datos.productos)) throw new Error('Catálogo inválido: falta «productos».');
  const hechosFiables = datos.version === VERSION_MOTOR;

  const entradas: Entrada[] = [];
  const porHandle = new Map<string, Entrada>();
  for (const p of datos.productos) {
    if (!p || typeof p.handle !== 'string' || typeof p.titulo !== 'string' || porHandle.has(p.handle)) continue;
    const e: Entrada = {
      producto: p,
      titulo: tokensCanon(p.titulo),
      tipo: tokensCanon(p.tipo ?? ''),
      extra: new Set([
        ...tokensCanon(p.tipo ?? ''),
        ...(p.etiquetas ?? []).filter((x) => !ETIQUETAS_INTERNAS.test(x)).flatMap((x) => tokensCanon(x.replace(/-/g, ' '))),
        ...tokensCanon(p.handle.replace(/-/g, ' ')),
      ]),
      hechos: hechosFiables && hechosValidos(p.hechos) ? p.hechos : undefined,
    };
    entradas.push(e);
    porHandle.set(p.handle, e);
  }

  const ficha = (e: Entrada): Ficha => (e.ficha ??= crearFicha(e.producto));
  const hechos = (e: Entrada): Hechos => (e.hechos ??= hechosDe(ficha(e)));
  const categorias = [...new Set(entradas.map((e) => e.producto.tipo?.trim()).filter((t): t is string => !!t))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  function puntuados(consulta: string): Array<{ e: Entrada; puntuacion: number }> {
    const q = tokensCanon(consulta);
    return entradas
      .map((e) => ({ e, puntuacion: puntuar(q, e) }))
      .filter((r) => r.puntuacion > 0)
      .sort((a, b) => b.puntuacion - a.puntuacion || a.e.producto.titulo.localeCompare(b.e.producto.titulo, 'es'));
  }

  function buscar(consulta: string, max = 3): Resultado[] {
    const directo = porHandle.get(consulta.trim().toLowerCase().replace(/^\/?products\//, ''));
    if (directo) return [{ ficha: ficha(directo), puntuacion: 2 }];
    return puntuados(consulta)
      .slice(0, max)
      .map(({ e, puntuacion }) => ({ ficha: ficha(e), puntuacion }));
  }

  function buscarIngrediente(ingrediente: string, max = 2): Resultado[] {
    const todos = tokensCanon(ingrediente);
    const nucleo = todos.filter((t) => !PROCESADO.has(t));
    const q = nucleo.length ? nucleo : todos;
    if (!q.length) return [];
    return entradas
      .filter((e) => {
        const cabeza = e.titulo.find((t) => !PREFIJOS_FORMATO.has(t));
        return cabeza !== undefined && coincide(q[0], cabeza) && q.every((t) => e.titulo.some((x) => coincide(t, x)));
      })
      .map((e) => ({ e, puntuacion: puntuar(q, e) }))
      .sort((a, b) => b.puntuacion - a.puntuacion || a.e.producto.titulo.localeCompare(b.e.producto.titulo, 'es'))
      .slice(0, max)
      .map(({ e, puntuacion }) => ({ ficha: ficha(e), puntuacion }));
  }

  function filtrar(c: Criterios): { total: number; resultados: Resultado[] } {
    let candidatos: Array<{ e: Entrada; puntuacion: number }> = c.texto ? puntuados(c.texto) : entradas.map((e) => ({ e, puntuacion: 0 }));

    if (c.categoria) {
      const cat = tokensCanon(c.categoria);
      candidatos = candidatos.filter(({ e }) => cat.length > 0 && cat.every((t) => e.tipo.some((x) => coincide(t, x))));
    }

    const numericos =
      [c.maxAzucares, c.minProteinas, c.minFibra, c.maxKcal, c.maxSal, c.maxGrasas].some((v) => v !== null) || c.orden !== 'relevancia';
    const excluir = new Set<string>(c.excluirAlergenos);
    const quiereSinGluten = c.sinGlutenEnIngredientes || excluir.has('gluten');

    candidatos = candidatos.filter(({ e }) => {
      const h = hechos(e);
      if (excluir.size) {
        if (h.fa || h.pa) return false;
        if (h.al.some((a) => excluir.has(a.replace('?', '')))) return false;
      }
      if (quiereSinGluten && !ESTADOS_SIN_GLUTEN.includes(h.g)) return false;
      if (c.sinAzucarAnadido && h.az !== 'no') return false;
      if (c.vegano && h.v !== 'si') return false;
      if (numericos) {
        // Las tablas «por 100 ml de infusión» no se comparan con productos sólidos (n = null).
        if (!h.n) return false;
        const [kcal, grasas, azucares, fibra, proteinas, sal] = h.n;
        if (c.maxAzucares !== null && (azucares === null || azucares > c.maxAzucares)) return false;
        if (c.minProteinas !== null && (proteinas === null || proteinas < c.minProteinas)) return false;
        if (c.minFibra !== null && (fibra === null || fibra < c.minFibra)) return false;
        if (c.maxKcal !== null && (kcal === null || kcal > c.maxKcal)) return false;
        if (c.maxSal !== null && (sal === null || sal > c.maxSal)) return false;
        if (c.maxGrasas !== null && (grasas === null || grasas > c.maxGrasas)) return false;
      }
      return true;
    });

    const indiceOrden: Partial<Record<Orden, [number, 1 | -1]>> = {
      mas_proteina: [4, -1],
      mas_fibra: [3, -1],
      menos_azucar: [2, 1],
      menos_kcal: [0, 1],
      menos_sal: [5, 1],
    };
    const orden = indiceOrden[c.orden];
    if (orden) {
      const [i, signo] = orden;
      const valor = (e: Entrada) => {
        const v = hechos(e).n?.[i];
        return v === null || v === undefined ? Infinity : signo * v;
      };
      candidatos.sort((a, b) => valor(a.e) - valor(b.e) || a.e.producto.titulo.localeCompare(b.e.producto.titulo, 'es'));
    }
    const limite = Math.max(1, Math.min(10, Math.trunc(c.limite) || 5));
    return {
      total: candidatos.length,
      resultados: candidatos.slice(0, limite).map(({ e, puntuacion }) => ({ ficha: ficha(e), puntuacion })),
    };
  }

  return {
    get fichas() {
      return entradas.map(ficha);
    },
    total: entradas.length,
    categorias,
    generado: datos.generado ?? null,
    porHandle: (h) => {
      const e = porHandle.get(h);
      return e ? ficha(e) : undefined;
    },
    buscar,
    buscarIngrediente,
    filtrar,
    hechos: () => entradas.map((e) => ({ handle: e.producto.handle, hechos: hechos(e) })),
  };
}
