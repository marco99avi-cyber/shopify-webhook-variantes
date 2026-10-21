/**
 * Ficha nutricional de un producto de la tienda: une ingredientes, alérgenos y tabla
 * nutricional en veredictos claros, con resúmenes ya redactados para las respuestas delicadas
 * (gluten, alérgenos, azúcar). El modelo los usa tal cual en vez de improvisar.
 */

import { ALERGENOS, NOMBRE_ALERGENO, type AlergenoId } from './conocimiento/alergenos.ts';
import { GLUTEN } from './conocimiento/declaraciones.ts';
import { PRODUCTOS_AZUCAR } from './conocimiento/azucares.ts';
import {
  analizarAditivos,
  analizarAzucares,
  ingredientesAnimales,
  precaucionesPara,
  type AditivoDetectado,
  type Azucares,
  type PrecaucionAplicable,
} from './composicion.ts';
import { detectarAlergenos, unirAlergenos, type ResultadoAlergenos } from './deteccion.ts';
import {
  declaracionesNutricionales,
  declaracionesSalud,
  kcalCalculadas,
  leerNutricion,
  niveles,
  type Niveles,
  type Nutricion,
} from './nutricion.ts';
import { mostrar, tokensDeFrase, tokenizar } from './texto.ts';

/** Lo que exporta el script de catálogo para cada producto (textos tal cual de Shopify). */
export interface ProductoCrudo {
  handle: string;
  titulo: string;
  tipo?: string | null;
  etiquetas?: string[];
  ingredientes?: string | null;
  alergenos?: string | null;
  nutricional?: string | null;
  gramosRacion?: number | null;
  unidadRacion?: string | null;
}

export type VeredictoGluten =
  | 'contiene'
  | 'puede_contener'
  | 'sin_confirmar'
  | 'sin_datos'
  | 'sin_gluten_en_ingredientes'
  | 'declara_sin_gluten';

export interface Gluten {
  veredicto: VeredictoGluten;
  /** Nunca true para productos a granel sin certificación. */
  aptoCeliacos: boolean;
  terminos: string[];
  resumen: string;
}

export type EstadoAzucarAnadido = 'si' | 'no' | 'posible' | 'desconocido' | 'no_aplica';

export interface AzucarFicha {
  gramos100: number | null;
  nivel: Niveles['azucares'];
  anadido: EstadoAzucarAnadido;
  fuentes: string[];
  posibles: string[];
  polialcoholes: string[];
  edulcorantes: string[];
  incoherencia: string | null;
  resumen: string;
}

export interface AlergenoFicha {
  id: AlergenoId;
  nombre: string;
  estado: 'contiene' | 'puede_contener';
  terminos: string[];
  nota?: string;
}

export interface Ficha {
  handle: string;
  titulo: string;
  url: string;
  tipo: string | null;
  etiquetas: string[];
  textos: { ingredientes: string | null; alergenos: string | null; nutricional: string | null };
  datosQueFaltan: string[];
  pendienteDeConfirmar: boolean;
  gluten: Gluten;
  alergenos: AlergenoFicha[];
  alergenosResumen: string;
  trazasGenericas: boolean;
  azucar: AzucarFicha;
  nutricion: Nutricion | null;
  niveles: Niveles | null;
  declaraciones: string[];
  declaracionesSalud: { frases: string[]; mencion: string } | null;
  vegano: { estado: 'si' | 'no' | 'probable' | 'desconocido'; motivo: string | null };
  aditivos: AditivoDetectado[];
  precauciones: PrecaucionAplicable[];
  racion: { gramos: number; unidad: string } | null;
  /** Coherencia de la tabla: diferencia entre kcal declaradas y calculadas. */
  energia: { declaradas: number | null; calculadas: number | null } | null;
  /** Detección cruda, para la auditoría. */
  deteccion: { alergenos: ResultadoAlergenos; desdeIngredientes: ResultadoAlergenos; azucares: Azucares };
}

const AVISO_GRANEL =
  'Se vende a granel: aunque se manipula con cuidado, no podemos descartar el contacto cruzado con otros productos.';

function lista(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}

function tieneEtiqueta(etiquetas: readonly string[], e: string): boolean {
  return etiquetas.some((x) => x.toLowerCase() === e);
}

export function veredictoGluten(
  det: ResultadoAlergenos,
  contexto: { hayDatos: boolean; certificado: boolean; esTienda: boolean; hayIngredientes?: boolean },
): Gluten {
  const g = det.alergenos.gluten;
  const terminos = g.terminos.filter((t) => t !== 'gluten').map(mostrar);
  const cuales = terminos.length ? ` (${lista(terminos)})` : '';

  if (g.estado === 'contiene' && !g.sinGlutenDeclarado) {
    const avena = terminos.length === 1 && terminos[0] === 'avena';
    return {
      veredicto: 'contiene',
      aptoCeliacos: false,
      terminos,
      resumen: `Lleva gluten${cuales}. No es apto para celíacos.${
        avena ? ' La avena solo es apta para la mayoría de celíacos si está certificada «sin gluten».' : ''
      }`,
    };
  }
  if ((g.estado === 'contiene' && g.sinGlutenDeclarado) || (contexto.certificado && g.estado !== 'puede_contener')) {
    return {
      veredicto: 'declara_sin_gluten',
      aptoCeliacos: true,
      terminos,
      resumen: `Declara «sin gluten»: por ley tiene ${GLUTEN.sinGlutenMgKg} mg/kg o menos (${GLUTEN.norma}), apto para la mayoría de celíacos.`,
    };
  }
  if (g.estado === 'puede_contener') {
    return {
      veredicto: 'puede_contener',
      aptoCeliacos: false,
      terminos,
      resumen: det.pendiente
        ? `Puede llevar gluten${cuales}: la composición está pendiente de confirmar con el proveedor. No lo recomendamos a celíacos.`
        : `Puede tener trazas de gluten${cuales}. No es apto para celíacos.`,
    };
  }
  if (det.pendiente) {
    return {
      veredicto: 'sin_confirmar',
      aptoCeliacos: false,
      terminos,
      resumen: 'La información de alérgenos está pendiente de confirmar con el proveedor: no podemos asegurar si lleva gluten.',
    };
  }
  if (!contexto.hayDatos) {
    return {
      veredicto: 'sin_datos',
      aptoCeliacos: false,
      terminos,
      resumen: 'No tenemos la información de alérgenos de este producto, así que no podemos decir si lleva gluten.',
    };
  }
  const trazas = det.trazasGenericas ? ' La ficha avisa de posibles trazas por envasado compartido.' : '';
  const exento =
    g.estado === 'exento'
      ? ` Lleva ${lista(terminos.length ? terminos : ['un derivado de cereal'])} en una forma exenta (jarabe de glucosa, dextrosa o maltodextrina), que por ley no cuenta como gluten.`
      : '';
  const base = contexto.hayIngredientes === false
    ? 'Según su ficha de alérgenos no lleva gluten (no tenemos la lista completa de ingredientes).'
    : 'Por sus ingredientes no lleva gluten.';
  return {
    veredicto: 'sin_gluten_en_ingredientes',
    aptoCeliacos: false,
    terminos,
    resumen: contexto.esTienda
      ? `${base}${exento}${trazas} No está certificado «sin gluten» y se vende a granel, así que no podemos descartar trazas por contacto cruzado: si eres celíaco o muy sensible, no te lo podemos garantizar.`
      : `Por sus ingredientes no lleva gluten.${exento} Pero no declara «sin gluten»: sin esa mención no está garantizado para celíacos (puede haber trazas).`,
  };
}

function alergenosDeFicha(det: ResultadoAlergenos): AlergenoFicha[] {
  const salida: AlergenoFicha[] = [];
  for (const def of ALERGENOS) {
    const d = det.alergenos[def.id];
    if (d.estado !== 'contiene' && d.estado !== 'puede_contener') continue;
    if (def.id === 'gluten' && d.sinGlutenDeclarado) continue;
    salida.push({ id: def.id, nombre: NOMBRE_ALERGENO[def.id], estado: d.estado, terminos: d.terminos.map(mostrar), nota: d.nota });
  }
  return salida;
}

export function resumenAlergenos(als: readonly AlergenoFicha[], det: ResultadoAlergenos, hayDatos: boolean, esTienda: boolean): string {
  if (!hayDatos) return 'No tenemos la información de alérgenos de este producto.';
  const contiene = als.filter((a) => a.estado === 'contiene').map((a) => a.nombre.toLowerCase());
  const puede = als.filter((a) => a.estado === 'puede_contener').map((a) => a.nombre.toLowerCase());
  const partes: string[] = [];
  if (contiene.length) partes.push(`Contiene: ${lista(contiene)}.`);
  if (puede.length) partes.push(`Puede contener: ${lista(puede)}.`);
  if (!contiene.length && !puede.length) partes.push('No contiene ninguno de los 14 alérgenos de declaración obligatoria.');
  if (det.pendiente) partes.push('Ojo: la información está pendiente de confirmar con el proveedor.');
  if (det.trazasGenericas && !puede.length) partes.push('La ficha avisa de posibles trazas.');
  if (esTienda) partes.push(AVISO_GRANEL);
  return partes.join(' ');
}

function esUnAzucar(titulo: string): boolean {
  const t = tokenizar(titulo);
  return PRODUCTOS_AZUCAR.some((p) => {
    const ft = tokensDeFrase(p);
    // Solo si el producto ES el azúcar («Miel cruda…»), no si lo lleva («Cacahuete frito miel»).
    return t.length > 0 && ft.length > 0 && t[0] === ft[0];
  });
}

/**
 * Arándano rojo «sin azúcar añadido» con mucho azúcar: el arándano fresco es muy ácido y
 * tiene poco azúcar, así que 40 g o más por 100 g en deshidratado apunta a infusión con
 * azúcar o zumo concentrado (que legalmente también es azúcar añadido).
 */
export function sospechaAzucarOculto(titulo: string, anadido: EstadoAzucarAnadido, azucares: number | null): boolean {
  return ` ${tokenizar(titulo).join(' ')} `.includes(' arandano ') && anadido === 'no' && (azucares ?? 0) >= 40;
}

export function azucarDe(
  n: Nutricion | null,
  az: Azucares,
  hayIngredientes: boolean,
  titulo: string | null,
  pendiente = false,
): AzucarFicha {
  const g = n?.azucares ?? null;
  const niv = n ? niveles(n).azucares : null;
  const unAzucar = titulo !== null && esUnAzucar(titulo);

  let anadido: EstadoAzucarAnadido;
  if (unAzucar) anadido = 'no_aplica';
  else if (az.anadidos.length) anadido = 'si';
  else if (az.posibles.length) anadido = 'posible';
  else if (pendiente) anadido = 'desconocido';
  else if (hayIngredientes || az.declaraSinAnadidos) anadido = 'no';
  else anadido = 'desconocido';

  const anadidosVer = az.anadidos.map(mostrar);
  const posiblesVer = az.posibles.map(mostrar);
  let incoherencia =
    az.declaraSinAnadidos && (az.anadidos.length || az.posibles.length)
      ? `Dice «sin azúcares añadidos» pero la lista incluye ${lista([...anadidosVer, ...posiblesVer])}: lo estamos revisando con el proveedor.`
      : null;
  if (!incoherencia && titulo !== null && sospechaAzucarOculto(titulo, anadido, g)) {
    incoherencia =
      'La ficha dice «sin azúcar añadido», pero la cifra de azúcares es muy alta para un arándano sin endulzar: lo estamos verificando con el proveedor.';
  }

  const base = n?.base === 'bebida_preparada' ? '100 ml' : '100 g';
  const cifra = g === null ? 'No tenemos el dato de azúcares.' : `${String(g).replace('.', ',')} g de azúcares por ${base}${niv ? ` (nivel ${niv})` : ''}.`;
  let detalle: string;
  switch (anadido) {
    case 'no_aplica':
      detalle = 'Es en sí un azúcar: todo su dulzor son azúcares.';
      break;
    case 'si':
      detalle = `Lleva azúcar añadido: ${lista(anadidosVer)}.`;
      break;
    case 'posible':
      detalle = `Puede llevar azúcar añadido (${lista(posiblesVer)}).`;
      break;
    case 'no':
      detalle = titulo !== null && sospechaAzucarOculto(titulo, anadido, g)
        ? 'La ficha indica «sin azúcar añadido».'
        : g !== null && g > 5
          ? 'No lleva azúcar añadido: son azúcares propios del producto.'
          : 'No lleva azúcar añadido.';
      break;
    default:
      detalle = pendiente
        ? 'La lista de ingredientes está pendiente de confirmar, así que no podemos asegurar si lleva azúcar añadido.'
        : 'No tenemos la lista de ingredientes, así que no podemos confirmar si lleva azúcar añadido.';
  }
  const extra = [
    az.polialcoholes.length ? `Lleva polialcoholes (${lista(az.polialcoholes)}).` : '',
    az.edulcorantes.length ? `Lleva edulcorantes (${lista(az.edulcorantes)}).` : '',
    ...az.avisos,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    gramos100: g,
    nivel: niv,
    anadido,
    fuentes: anadidosVer,
    posibles: posiblesVer,
    polialcoholes: az.polialcoholes,
    edulcorantes: az.edulcorantes,
    incoherencia,
    resumen: [cifra, detalle, extra, incoherencia ?? ''].filter(Boolean).join(' '),
  };
}

const ALERGENOS_ANIMALES: readonly AlergenoId[] = ['leche', 'huevo', 'pescado', 'crustaceos', 'moluscos'];

export function veganoDe(
  det: ResultadoAlergenos,
  ingredientes: string | null,
  titulo: string,
  aditivos: readonly AditivoDetectado[],
  etiquetadoVegano: boolean,
  pendiente = false,
): Ficha['vegano'] {
  const animales = [
    ...ALERGENOS_ANIMALES.filter((id) => det.alergenos[id].estado === 'contiene').map((id) => NOMBRE_ALERGENO[id].toLowerCase()),
    ...ingredientesAnimales(`${titulo}. ${ingredientes ?? ''}`).map(mostrar),
    ...aditivos.filter((a) => a.origenAnimal === true).map((a) => `${a.codigo} (${a.nombre})`),
  ];
  if (animales.length) return { estado: 'no', motivo: `Lleva ingredientes de origen animal: ${lista([...new Set(animales)])}.` };
  const dudosos = aditivos.filter((a) => a.origenAnimal === 'posible').map((a) => `${a.codigo} (${a.nombre})`);
  if (dudosos.length) return { estado: 'probable', motivo: `Puede ser vegano, pero ${lista(dudosos)} puede ser de origen animal.` };
  if (pendiente) return { estado: 'desconocido', motivo: 'La composición está pendiente de confirmar con el proveedor.' };
  if (etiquetadoVegano) return { estado: 'si', motivo: null };
  if (ingredientes) return { estado: 'probable', motivo: 'No vemos ingredientes de origen animal, pero no está marcado como vegano.' };
  return { estado: 'desconocido', motivo: 'No tenemos la lista de ingredientes.' };
}

export function crearFicha(p: ProductoCrudo): Ficha {
  const ingredientes = p.ingredientes?.trim() || null;
  const alergenosTxt = p.alergenos?.trim() || null;
  const nutricionalTxt = p.nutricional?.trim() || null;
  const etiquetas = (p.etiquetas ?? []).map((e) => e.toLowerCase());

  const desdeAlergenos = detectarAlergenos(alergenosTxt);
  const desdeIngredientes = detectarAlergenos(ingredientes);
  const det = unirAlergenos(desdeAlergenos, desdeIngredientes);
  // Sin el campo de alérgenos no afirmamos ausencias (sí presencias, si salen en ingredientes).
  const hayDatosAlergenos = alergenosTxt !== null;
  const certificado = /certificad[oa]s? sin gluten/.test(` ${tokenizar(`${alergenosTxt ?? ''} ${ingredientes ?? ''}`).join(' ')} `);

  const nutricion = leerNutricion(nutricionalTxt);
  const azucares = analizarAzucares(ingredientes);
  const aditivos = analizarAditivos(ingredientes).detectados;
  const alergenos = alergenosDeFicha(det);

  const faltan: string[] = [];
  if (!ingredientes) faltan.push('ingredientes');
  if (!alergenosTxt) faltan.push('alérgenos');
  if (!nutricionalTxt) faltan.push('información nutricional');
  else if (!nutricion) faltan.push('información nutricional legible');

  return {
    handle: p.handle,
    titulo: p.titulo,
    url: `/products/${p.handle}`,
    tipo: p.tipo?.trim() || null,
    etiquetas,
    textos: { ingredientes, alergenos: alergenosTxt, nutricional: nutricionalTxt },
    datosQueFaltan: faltan,
    pendienteDeConfirmar: det.pendiente || (nutricion?.estimada ?? false),
    gluten: veredictoGluten(det, { hayDatos: hayDatosAlergenos, certificado, esTienda: true, hayIngredientes: ingredientes !== null }),
    alergenos,
    alergenosResumen: resumenAlergenos(alergenos, det, hayDatosAlergenos, true),
    trazasGenericas: det.trazasGenericas,
    azucar: azucarDe(nutricion, azucares, ingredientes !== null, p.titulo, desdeIngredientes.pendiente),
    nutricion,
    niveles: nutricion ? niveles(nutricion) : null,
    declaraciones: nutricion ? declaracionesNutricionales(nutricion) : [],
    declaracionesSalud: nutricion ? declaracionesSalud(nutricion) : null,
    vegano: veganoDe(det, ingredientes, p.titulo, aditivos, tieneEtiqueta(etiquetas, 'vegano'), desdeIngredientes.pendiente),
    aditivos,
    precauciones: precaucionesPara(`${p.titulo}. ${ingredientes ?? ''}`, p.titulo),
    racion:
      typeof p.gramosRacion === 'number' && p.gramosRacion > 0 && p.gramosRacion < 1000
        ? { gramos: p.gramosRacion, unidad: p.unidadRacion?.trim() || 'ración' }
        : null,
    energia: nutricion ? { declaradas: nutricion.kcal, calculadas: kcalCalculadas(nutricion) } : null,
    deteccion: { alergenos: det, desdeIngredientes, azucares },
  };
}
