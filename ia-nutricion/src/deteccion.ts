/**
 * Motor de detección de alérgenos en texto libre (fichas de la tienda o etiquetas que pega el
 * cliente). Determinista: mismas entradas, mismas salidas, sin llamadas a ningún modelo.
 *
 * Para cada término encontrado decide el estado mirando hacia atrás dentro de la misma frase:
 *   «Contiene gluten (avena)»                    → contiene
 *   «Puede contener trazas de leche»             → puede_contener
 *   «No contiene alérgenos … ni cereales con gluten» → negado
 *   «Pasta sin gluten», «no soja», «no es un fruto de cáscara» → negado (alcance corto)
 *   «emulgentes (lecitina de soja)»              → contiene (mención en la lista de ingredientes)
 */

import { ALERGENOS, type AlergenoId, type DefinicionAlergeno } from './conocimiento/alergenos.ts';
import { FIN_DE_FRASE, PUNTUACION, buscarFrase, coincideEn, tokenizar, tokensDeFrase } from './texto.ts';

export type EstadoAlergeno = 'contiene' | 'puede_contener' | 'exento' | 'negado' | 'no_detectado';

export interface DeteccionAlergeno {
  estado: EstadoAlergeno;
  /** Términos que lo han activado, tal cual quedaron normalizados («lecitina», «trigo»). */
  terminos: string[];
  /** Nota explicativa si la detección vino de un término ambiguo o exento. */
  nota?: string;
  /** Solo gluten: todas las menciones van seguidas de «sin gluten» («avena sin gluten»). */
  sinGlutenDeclarado?: boolean;
}

export interface ResultadoAlergenos {
  alergenos: Record<AlergenoId, DeteccionAlergeno>;
  /** El texto avisa de trazas o manipulación compartida sin decir de qué. */
  trazasGenericas: boolean;
  /** El texto dice que los datos están pendientes de confirmar. */
  pendiente: boolean;
  /** El texto declara literalmente «sin gluten». */
  declaraSinGluten: boolean;
  /** «No contiene alérgenos de declaración obligatoria». */
  declaraSinAlergenos: boolean;
}

const PRIORIDAD: Record<EstadoAlergeno, number> = {
  contiene: 4,
  puede_contener: 3,
  exento: 2,
  negado: 1,
  no_detectado: 0,
};

type Marcador = 'contiene' | 'puede_contener' | 'negado' | null;

/** «para cocinar caracoles», «para marinar pescado»: el término es el destino, no un ingrediente. */
const VERBOS_DE_USO = new Set(['cocinar', 'preparar', 'acompanar', 'sazonar', 'condimentar', 'marinar', 'rebozar', 'guisar', 'alinar', 'hacer', 'elaborar']);
/** Frases de sugerencia de receta: lo que viene detrás no está en el producto. */
const SUGERENCIA = new Set(['combinalo', 'combinala', 'acompanalo', 'acompanala', 'sirvelo', 'sirvela', 'sugerencia']);

/** Lo que gobierna al término en la posición `i`, buscando hacia atrás dentro de su frase. */
export function marcadorPrevio(tokens: readonly string[], i: number): Marcador {
  let puntuacionEntre = false;
  for (let j = i - 1; j >= 0; j--) {
    const t = tokens[j];
    if (FIN_DE_FRASE.has(t)) break;
    if (PUNTUACION.has(t)) {
      puntuacionEntre = true;
      continue;
    }
    const distancia = i - j;
    const siguiente = tokens[j + 1];
    const anterior = tokens[j - 1];

    // Propósito: «para pescado», «para cocinar caracoles» (no «masa para pizza de trigo»).
    if (!puntuacionEntre && t === 'para' && (distancia === 1 || (distancia === 2 && VERBOS_DE_USO.has(tokens[i - 1])))) {
      return 'negado';
    }

    // Negaciones de alcance corto: «sin gluten», «libre de lactosa», «no soja», «no es un fruto…»
    if (!puntuacionEntre && distancia <= 5) {
      if (t === 'sin') return 'negado';
      if ((t === 'libre' || t === 'exento' || t === 'exenta') && siguiente === 'de') return 'negado';
      if (t === 'no' && (distancia <= 2 || siguiente === 'es' || siguiente === 'lleva' || siguiente === 'tiene')) {
        return 'negado';
      }
    }

    // Marcadores de alcance largo (toda la frase)
    if (t === 'contiene' || t === 'contener' || t === 'lleva' || t === 'llevar' || t === 'tiene') {
      if (anterior === 'no') return 'negado';
      if (anterior === 'puede' || anterior === 'pueda' || anterior === 'podria' || anterior === 'pueden') {
        return 'puede_contener';
      }
      if (t === 'contiene' || t === 'lleva') return 'contiene';
      continue;
    }
    if (t === 'traza' || t === 'compartido' || t === 'compartida' || t === 'posible') return 'puede_contener';
    // «en la preparación puede incorporar pescado»: aviso, no ingrediente.
    if (t === 'incorporar' && (anterior === 'puede' || anterior === 'pueden')) return 'puede_contener';
    if (SUGERENCIA.has(t)) return 'negado';
    if (t === 'cruzado' && anterior === 'contacto') return 'puede_contener';
    if (t === 'tambien' && (anterior === 'que' || anterior === 'donde')) return 'puede_contener';
  }
  return null;
}

type Frases = ReadonlyArray<readonly [string, readonly string[]]>;
const tok = (xs: readonly string[] | undefined): Frases => (xs ?? []).map((f) => [f, tokensDeFrase(f)] as const);

/** Diccionario ya tokenizado: se hace una vez al cargar el módulo. */
const DICCIONARIO = ALERGENOS.map((def) => ({
  def,
  terminos: tok(def.terminos),
  ambiguos: tok(def.ambiguos),
  exclusiones: tok(def.exclusiones),
  exentos: tok(def.exentos),
  exclusionesAmbiguos: tok(def.exclusionesAmbiguos),
}));

/** Rangos [inicio, fin) que cubren las apariciones de cualquiera de las frases. */
function rangos(tokens: readonly string[], frases: Frases): Array<[number, number]> {
  const salida: Array<[number, number]> = [];
  for (const [, ft] of frases) {
    for (const p of buscarFrase(tokens, ft)) salida.push([p, p + ft.length]);
  }
  return salida;
}

function solapa(rs: ReadonlyArray<[number, number]>, ini: number, fin: number): boolean {
  return rs.some(([a, b]) => ini < b && fin > a);
}

function mejorEstado(a: EstadoAlergeno, b: EstadoAlergeno): EstadoAlergeno {
  return PRIORIDAD[b] > PRIORIDAD[a] ? b : a;
}

interface Aparicion {
  estado: EstadoAlergeno;
  termino: string;
  seguidoDeSinGluten: boolean;
  nota?: string;
}

function aparicionesDe(d: (typeof DICCIONARIO)[number], tokens: readonly string[]): Aparicion[] {
  const def: DefinicionAlergeno = d.def;
  const salida: Aparicion[] = [];
  // Primero, ¿aparece algún término? Si no, no hace falta calcular exclusiones.
  const hay = (fs: Frases) => fs.some(([, ft]) => buscarFrase(tokens, ft).length > 0);
  if (!hay(d.terminos) && !hay(d.ambiguos)) return salida;
  const excl = rangos(tokens, d.exclusiones);
  const exen = rangos(tokens, d.exentos);
  const exclAmb = rangos(tokens, d.exclusionesAmbiguos);

  const evaluar = (frase: string, ft: readonly string[], ambiguo: boolean) => {
    for (const p of buscarFrase(tokens, ft)) {
      const fin = p + ft.length;
      if (solapa(excl, p, fin)) continue;
      if (ambiguo && solapa(exclAmb, p, fin)) continue;
      const seguidoDeSinGluten = coincideEn(tokens, fin, ['sin', 'gluten']);
      if (solapa(exen, p, fin)) {
        salida.push({ estado: 'exento', termino: frase, seguidoDeSinGluten, nota: def.notaExentos });
        continue;
      }
      const m = marcadorPrevio(tokens, p);
      let estado: EstadoAlergeno = m === 'negado' ? 'negado' : m === 'puede_contener' ? 'puede_contener' : 'contiene';
      if (ambiguo && estado === 'contiene') estado = 'puede_contener';
      salida.push({ estado, termino: frase, seguidoDeSinGluten, nota: ambiguo ? def.notasAmbiguos?.[frase] : undefined });
    }
  };

  for (const [t, ft] of d.terminos) evaluar(t, ft, false);
  for (const [t, ft] of d.ambiguos) evaluar(t, ft, true);
  return salida;
}

function vacio(): Record<AlergenoId, DeteccionAlergeno> {
  return Object.fromEntries(ALERGENOS.map((a) => [a.id, { estado: 'no_detectado', terminos: [] }])) as unknown as Record<
    AlergenoId,
    DeteccionAlergeno
  >;
}

/** Detecta los 14 alérgenos en un texto. Texto vacío → todo «no_detectado». */
export function detectarAlergenos(texto: string | null | undefined): ResultadoAlergenos {
  const alergenos = vacio();
  const tokens = tokenizar(texto ?? '');
  const unido = ' ' + tokens.join(' ') + ' ';

  for (const d of DICCIONARIO) {
    const def = d.def;
    const apariciones = aparicionesDe(d, tokens);
    if (apariciones.length === 0) continue;
    const det: DeteccionAlergeno = { estado: 'no_detectado', terminos: [] };
    for (const a of apariciones) {
      det.estado = mejorEstado(det.estado, a.estado);
      if (!det.terminos.includes(a.termino)) det.terminos.push(a.termino);
      if (a.nota && !det.nota) det.nota = a.nota;
    }
    if (def.id === 'gluten') {
      const activas = apariciones.filter((a) => a.estado === 'contiene' || a.estado === 'puede_contener');
      // «Avena sin gluten» sí; «avena sin gluten, puede contener trazas de gluten» no.
      det.sinGlutenDeclarado =
        activas.length > 0 && activas.every((a) => a.termino !== 'gluten' && a.seguidoDeSinGluten);
    }
    alergenos[def.id] = det;
  }

  return {
    alergenos,
    trazasGenericas: / traza | compartido | compartida | contacto cruzado /.test(unido),
    pendiente: / pendiente /.test(unido) || / sin confirmar /.test(unido),
    declaraSinGluten: / sin gluten /.test(unido),
    declaraSinAlergenos: / no contiene alergeno /.test(unido),
  };
}

/** Une dos detecciones quedándose con lo más prudente de cada alérgeno. */
export function unirAlergenos(a: ResultadoAlergenos, b: ResultadoAlergenos): ResultadoAlergenos {
  const alergenos = vacio();
  for (const def of ALERGENOS) {
    const x = a.alergenos[def.id];
    const y = b.alergenos[def.id];
    const estado = mejorEstado(x.estado, y.estado);
    alergenos[def.id] = {
      estado,
      terminos: [...new Set([...x.terminos, ...y.terminos])],
      nota: x.nota ?? y.nota,
      sinGlutenDeclarado:
        def.id === 'gluten'
          ? (x.estado === 'no_detectado' || x.sinGlutenDeclarado === true) &&
            (y.estado === 'no_detectado' || y.sinGlutenDeclarado === true) &&
            estado !== 'no_detectado'
          : undefined,
    };
  }
  return {
    alergenos,
    trazasGenericas: a.trazasGenericas || b.trazasGenericas,
    pendiente: a.pendiente || b.pendiente,
    declaraSinGluten: a.declaraSinGluten || b.declaraSinGluten,
    declaraSinAlergenos: a.declaraSinAlergenos || b.declaraSinAlergenos,
  };
}
