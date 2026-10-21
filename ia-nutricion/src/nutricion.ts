/**
 * Lectura de la tabla nutricional en texto libre y cálculos derivados.
 *
 * Formatos reales del catálogo que tiene que entender:
 *   «Energía 2322 kJ / 555 kcal» · «Energía: 350 kcal / 1480 kJ» · «energía 1.420 kJ / 335 kcal»
 *   «Grasas 16.0 g» · «Sal 0,02 g» · «Hierro 28 mg (200% VRN)» · «Vitamina B12 25 µg»
 *   «por 100 g de producto crudo» · «por 100 g de infusión preparada» · «Por 100 ml de infusión»
 */

import {
  DECLARACIONES_SALUD,
  KCAL_POR_GRAMO,
  MENCION_DIETA_VARIADA,
  SEMAFORO,
  VRN,
  nivel,
  type Nivel,
} from './conocimiento/declaraciones.ts';

export type BaseNutricional = 'producto' | 'producto_crudo' | 'producto_seco' | 'bebida_preparada';

export interface Micronutriente {
  clave: string;
  nombre: string;
  cantidad: number;
  unidad: 'mg' | 'µg';
  /** % del VRN por 100 g: el declarado si lo hay, si no calculado. */
  vrnPct: number | null;
}

export interface Nutricion {
  base: BaseNutricional;
  /** Texto de la base tal cual («100 g de producto crudo»). */
  baseTexto: string;
  kcal: number | null;
  kj: number | null;
  grasas: number | null;
  saturadas: number | null;
  hidratos: number | null;
  azucares: number | null;
  fibra: number | null;
  proteinas: number | null;
  sal: number | null;
  micronutrientes: Micronutriente[];
  /** Valores estimados o pendientes de confirmar con el proveedor. */
  estimada: boolean;
  /** Nota del propio texto sobre la base («la infusión apenas aporta calorías»). */
  notaBase: string | null;
}

function minusculasSinTildes(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '');
}

/** «1.420» → 1420 (si es energía), «16.0» → 16, «0,02» → 0,02, «2.322» kJ → 2322. */
export function leerNumero(crudo: string, esEnergia = false): number | null {
  let s = crudo.trim();
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (esEnergia && /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace('.', '');
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
/** Como NUM pero acepta separador de miles con punto («1.420»), solo para energía. */
const NUM_ENERGIA = '(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)';

function buscarGramos(texto: string, etiqueta: string): number | null {
  const re = new RegExp(`${etiqueta}\\s*:?\\s*(?:de\\s+)?${NUM}\\s*g\\b`);
  const m = re.exec(texto);
  return m ? leerNumero(m[1]) : null;
}

const MICROS: ReadonlyArray<{ clave: string; patron: string }> = [
  { clave: 'hierro', patron: 'hierro' },
  { clave: 'calcio', patron: 'calcio' },
  { clave: 'magnesio', patron: 'magnesio' },
  { clave: 'potasio', patron: 'potasio' },
  { clave: 'fosforo', patron: 'fosforo' },
  { clave: 'zinc', patron: 'zinc' },
  { clave: 'cobre', patron: 'cobre' },
  { clave: 'manganeso', patron: 'manganeso' },
  { clave: 'selenio', patron: 'selenio' },
  { clave: 'yodo', patron: 'yodo' },
  { clave: 'cromo', patron: 'cromo' },
  { clave: 'vitamina-a', patron: 'vitamina a' },
  { clave: 'vitamina-c', patron: 'vitamina c' },
  { clave: 'vitamina-d', patron: 'vitamina d' },
  { clave: 'vitamina-e', patron: 'vitamina e' },
  { clave: 'vitamina-k', patron: 'vitamina k' },
  { clave: 'vitamina-b1', patron: '(?:vitamina b1|tiamina)' },
  { clave: 'vitamina-b2', patron: '(?:vitamina b2|riboflavina)' },
  { clave: 'vitamina-b3', patron: '(?:vitamina b3|niacina)' },
  { clave: 'vitamina-b6', patron: 'vitamina b6' },
  { clave: 'vitamina-b9', patron: '(?:vitamina b9|folato|acido folico)' },
  { clave: 'vitamina-b12', patron: '(?:vitamina b12|cobalamina)' },
];

// Compiladas una vez: se usan con cada ficha.
const MICROS_RE = MICROS.map(({ clave, patron }) => ({
  clave,
  re: new RegExp(`\\b${patron}\\b\\s*:?\\s*${NUM}\\s*(mg|µg|\u03BCg|ug|mcg)(?:\\s*\\(\\s*(\\d+(?:[.,]\\d+)?)\\s*%\\s*(?:del\\s+)?vrn)?`),
}));

function leerMicros(texto: string): Micronutriente[] {
  const salida: Micronutriente[] = [];
  if (!/mg|µg|\u03BCg|ug|mcg/.test(texto)) return salida;
  for (const { clave, re } of MICROS_RE) {
    const m = re.exec(texto);
    if (!m) continue;
    const cantidad = leerNumero(m[1]);
    if (cantidad === null) continue;
    const unidad: 'mg' | 'µg' = m[2] === 'mg' ? 'mg' : 'µg';
    const ref = VRN[clave];
    let vrnPct = m[3] ? leerNumero(m[3]) : null;
    if (vrnPct === null && ref) {
      const enUnidadRef = ref.unidad === unidad ? cantidad : unidad === 'mg' ? cantidad * 1000 : cantidad / 1000;
      vrnPct = Math.round((enUnidadRef / ref.valor) * 100);
    }
    salida.push({ clave, nombre: ref?.nombre ?? clave, cantidad, unidad, vrnPct });
  }
  return salida;
}

function leerBase(texto: string): { base: BaseNutricional; baseTexto: string } {
  const m = /por\s*100\s*(g|ml)\b(?:\s+de\s+([a-z ]{3,40}?))?\s*(?:[:;.,(]|\n|$)/.exec(texto);
  const unidad = m?.[1] ?? 'g';
  const de = (m?.[2] ?? '').trim();
  const baseTexto = `100 ${unidad}${de ? ' de ' + de : ''}`;
  if (unidad === 'ml' || /infusion|preparad|bebida/.test(de)) return { base: 'bebida_preparada', baseTexto };
  if (/crud/.test(de)) return { base: 'producto_crudo', baseTexto };
  if (/sec[oa]/.test(de)) return { base: 'producto_seco', baseTexto };
  return { base: 'producto', baseTexto };
}

/** Devuelve null si el texto no tiene ni energía ni macronutrientes reconocibles. */
export function leerNutricion(texto: string | null | undefined): Nutricion | null {
  if (!texto || !texto.trim()) return null;
  const t = minusculasSinTildes(texto);

  const kcalM = new RegExp(`${NUM_ENERGIA}\\s*kcal`).exec(t);
  const kjM = new RegExp(`${NUM_ENERGIA}\\s*kj`).exec(t);

  const n: Nutricion = {
    ...leerBase(t),
    kcal: kcalM ? leerNumero(kcalM[1], true) : null,
    kj: kjM ? leerNumero(kjM[1], true) : null,
    grasas: buscarGramos(t, '\\bgrasas?(?:\\s+totales)?'),
    saturadas: buscarGramos(t, '\\bsaturadas?'),
    hidratos: buscarGramos(t, '\\bhidratos de carbono'),
    azucares: buscarGramos(t, '\\bazucares'),
    fibra: buscarGramos(t, '\\bfibra(?:\\s+alimentaria)?'),
    proteinas: buscarGramos(t, '\\bproteinas?'),
    sal: buscarGramos(t, '\\bsal\\b'),
    micronutrientes: leerMicros(t),
    estimada: /estimaci|pendiente de confirmar|sin confirmar/.test(t),
    notaBase: null,
  };

  if (n.kcal === null && n.kj !== null) n.kcal = Math.round(n.kj / 4.184);
  // Frase que aclara la base («la infusión apenas aporta calorías»). Por frases, sin regex
  // con retroceso (el texto puede venir del cliente).
  const nota = t
    .split(/[.\n]/)
    .map((f) => f.trim())
    .find((f) => f.startsWith('el aporte') || f.includes('despreciable') || (f.startsWith('la infusion') && /aporta|calorias/.test(f)));
  if (nota) n.notaBase = nota;

  const reconocidos = [n.kcal, n.grasas, n.hidratos, n.proteinas].filter((v) => v !== null).length;
  return reconocidos >= 2 ? n : null;
}

/** Energía calculada con los factores del Anexo XIV (grasas 9, hidratos 4, proteínas 4, fibra 2). */
export function kcalCalculadas(n: Nutricion): number | null {
  if (n.grasas === null || n.hidratos === null || n.proteinas === null) return null;
  return Math.round(
    n.grasas * KCAL_POR_GRAMO.grasas +
      n.hidratos * KCAL_POR_GRAMO.hidratos +
      n.proteinas * KCAL_POR_GRAMO.proteinas +
      (n.fibra ?? 0) * KCAL_POR_GRAMO.fibra,
  );
}

export function esLiquida(n: Nutricion): boolean {
  return n.base === 'bebida_preparada';
}

export interface Niveles {
  grasas: Nivel | null;
  saturadas: Nivel | null;
  azucares: Nivel | null;
  sal: Nivel | null;
}

export function niveles(n: Nutricion): Niveles {
  const s = esLiquida(n) ? SEMAFORO.liquido : SEMAFORO.solido;
  return {
    grasas: nivel(n.grasas, s.grasas),
    saturadas: nivel(n.saturadas, s.saturadas),
    azucares: nivel(n.azucares, s.azucares),
    sal: nivel(n.sal, s.sal),
  };
}

function pctEnergiaProteina(n: Nutricion): number | null {
  if (n.proteinas === null || !n.kcal) return null;
  return (n.proteinas * 4 * 100) / n.kcal;
}

/**
 * Declaraciones nutricionales del Anexo del Reg. 1924/2006 que los números permiten.
 * Si una condición no se puede comprobar con los datos, la declaración no sale.
 */
export function declaracionesNutricionales(n: Nutricion): string[] {
  const liq = esLiquida(n);
  const d: string[] = [];
  const kcal = n.kcal;

  if (kcal !== null) {
    if (liq ? kcal <= 20 : kcal <= 40) d.push('bajo valor energético');
  }
  if (n.grasas !== null) {
    if (n.grasas <= 0.5) d.push('sin grasa');
    else if (n.grasas <= (liq ? 1.5 : 3)) d.push('bajo contenido de grasa');
  }
  if (n.saturadas !== null && kcal) {
    if (n.saturadas <= 0.1) d.push('sin grasas saturadas');
    else if (n.saturadas <= (liq ? 0.75 : 1.5) && (n.saturadas * 9 * 100) / kcal <= 10) {
      d.push('bajo contenido de grasas saturadas');
    }
  }
  if (n.azucares !== null) {
    if (n.azucares <= 0.5) d.push('sin azúcares');
    else if (n.azucares <= (liq ? 2.5 : 5)) d.push('bajo contenido de azúcares');
  }
  if (n.sal !== null) {
    if (n.sal <= 0.0125) d.push('sin sal');
    else if (n.sal <= 0.1) d.push('muy bajo contenido de sal');
    else if (n.sal <= 0.3) d.push('bajo contenido de sal');
  }
  if (n.fibra !== null && !liq) {
    const por100kcal = kcal ? (n.fibra * 100) / kcal : 0;
    if (n.fibra >= 6 || por100kcal >= 3) d.push('alto contenido de fibra');
    else if (n.fibra >= 3 || por100kcal >= 1.5) d.push('fuente de fibra');
  }
  const pct = pctEnergiaProteina(n);
  if (pct !== null) {
    if (pct >= 20) d.push('alto contenido de proteínas');
    else if (pct >= 12) d.push('fuente de proteínas');
  }
  for (const m of n.micronutrientes) {
    if (m.vrnPct === null) continue;
    const umbral = liq ? 7.5 : 15;
    if (m.vrnPct >= umbral * 2) d.push(`alto contenido de ${m.nombre}`);
    else if (m.vrnPct >= umbral) d.push(`fuente de ${m.nombre}`);
  }
  return d;
}

/**
 * Declaraciones de salud autorizadas que se pueden usar con este producto: solo para
 * nutrientes de los que es al menos «fuente». Devuelve también la mención obligatoria.
 */
export function declaracionesSalud(n: Nutricion): { frases: string[]; mencion: string } | null {
  const frases: string[] = [];
  const pct = pctEnergiaProteina(n);
  if (pct !== null && pct >= 12) frases.push(...(DECLARACIONES_SALUD.proteinas ?? []).slice(0, 2));
  const umbral = esLiquida(n) ? 7.5 : 15;
  for (const m of n.micronutrientes) {
    if (m.vrnPct !== null && m.vrnPct >= umbral) frases.push(...(DECLARACIONES_SALUD[m.clave] ?? []).slice(0, 2));
  }
  return frases.length ? { frases, mencion: MENCION_DIETA_VARIADA } : null;
}

/** Valores para una cantidad concreta (p. ej. una ración de 40 g). */
export function escalar(n: Nutricion, gramos: number): Record<string, number | null> {
  const f = gramos / 100;
  const r = (v: number | null, dec = 1) => (v === null ? null : Math.round(v * f * 10 ** dec) / 10 ** dec);
  return {
    gramos,
    kcal: r(n.kcal, 0),
    grasas: r(n.grasas),
    saturadas: r(n.saturadas),
    hidratos: r(n.hidratos),
    azucares: r(n.azucares),
    fibra: r(n.fibra),
    proteinas: r(n.proteinas),
    sal: r(n.sal, 2),
  };
}
