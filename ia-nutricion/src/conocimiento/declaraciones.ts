/**
 * Umbrales legales y de referencia para hablar de nutrición sin inventar nada.
 *
 * - Declaraciones nutricionales: Anexo del Reglamento (CE) n.º 1924/2006 (lista cerrada).
 * - Valores de referencia de nutrientes (VRN): Anexo XIII del Reglamento (UE) n.º 1169/2011.
 * - Declaraciones de salud: Reglamento (UE) n.º 432/2012, misma redacción que usa el tema
 *   (snippets/ag-claim-nutriente.liquid), para que el chat y la ficha digan lo mismo.
 * - «Sin gluten» / «muy bajo en gluten»: Reglamento de Ejecución (UE) n.º 828/2014.
 * - «Alto en…» no tiene umbral legal en la UE: usamos el semáforo de la FSA británica como
 *   referencia orientativa y lo decimos así.
 */

export const GLUTEN = {
  sinGlutenMgKg: 20,
  muyBajoMgKg: 100,
  norma: 'Reglamento de Ejecución (UE) n.º 828/2014',
} as const;

/** VRN para adultos (Anexo XIII Reg. 1169/2011). Unidad indicada en cada entrada. */
export const VRN: Readonly<Record<string, { valor: number; unidad: 'mg' | 'µg'; nombre: string }>> = {
  'vitamina-a': { valor: 800, unidad: 'µg', nombre: 'vitamina A' },
  'vitamina-d': { valor: 5, unidad: 'µg', nombre: 'vitamina D' },
  'vitamina-e': { valor: 12, unidad: 'mg', nombre: 'vitamina E' },
  'vitamina-k': { valor: 75, unidad: 'µg', nombre: 'vitamina K' },
  'vitamina-c': { valor: 80, unidad: 'mg', nombre: 'vitamina C' },
  'vitamina-b1': { valor: 1.1, unidad: 'mg', nombre: 'tiamina (B1)' },
  'vitamina-b2': { valor: 1.4, unidad: 'mg', nombre: 'riboflavina (B2)' },
  'vitamina-b3': { valor: 16, unidad: 'mg', nombre: 'niacina (B3)' },
  'vitamina-b5': { valor: 6, unidad: 'mg', nombre: 'ácido pantoténico (B5)' },
  'vitamina-b6': { valor: 1.4, unidad: 'mg', nombre: 'vitamina B6' },
  'vitamina-b7': { valor: 50, unidad: 'µg', nombre: 'biotina (B7)' },
  'vitamina-b9': { valor: 200, unidad: 'µg', nombre: 'folato (B9)' },
  'vitamina-b12': { valor: 2.5, unidad: 'µg', nombre: 'vitamina B12' },
  potasio: { valor: 2000, unidad: 'mg', nombre: 'potasio' },
  calcio: { valor: 800, unidad: 'mg', nombre: 'calcio' },
  fosforo: { valor: 700, unidad: 'mg', nombre: 'fósforo' },
  magnesio: { valor: 375, unidad: 'mg', nombre: 'magnesio' },
  hierro: { valor: 14, unidad: 'mg', nombre: 'hierro' },
  zinc: { valor: 10, unidad: 'mg', nombre: 'zinc' },
  cobre: { valor: 1, unidad: 'mg', nombre: 'cobre' },
  manganeso: { valor: 2, unidad: 'mg', nombre: 'manganeso' },
  selenio: { valor: 55, unidad: 'µg', nombre: 'selenio' },
  cromo: { valor: 40, unidad: 'µg', nombre: 'cromo' },
  yodo: { valor: 150, unidad: 'µg', nombre: 'yodo' },
};

/** Declaraciones de propiedades saludables autorizadas (Reg. 432/2012), por nutriente. */
export const DECLARACIONES_SALUD: Readonly<Record<string, readonly string[]>> = {
  proteinas: [
    'Las proteínas contribuyen a que aumente la masa muscular',
    'Las proteínas contribuyen a conservar la masa muscular',
    'Las proteínas contribuyen al mantenimiento de los huesos en condiciones normales',
  ],
  hierro: [
    'El hierro ayuda a disminuir el cansancio y la fatiga',
    'El hierro contribuye a la formación normal de glóbulos rojos y de hemoglobina',
    'El hierro contribuye al funcionamiento normal del sistema inmunitario',
  ],
  magnesio: [
    'El magnesio ayuda a disminuir el cansancio y la fatiga',
    'El magnesio contribuye al funcionamiento normal de los músculos y del sistema nervioso',
    'El magnesio contribuye a la función psicológica normal',
  ],
  calcio: [
    'El calcio es necesario para el mantenimiento de los huesos y los dientes en condiciones normales',
    'El calcio contribuye al funcionamiento normal de los músculos',
    'El calcio contribuye al funcionamiento normal de las enzimas digestivas',
  ],
  potasio: [
    'El potasio contribuye al funcionamiento normal del sistema nervioso y de los músculos',
    'El potasio contribuye al mantenimiento de la tensión arterial normal',
  ],
  fosforo: [
    'El fósforo contribuye al metabolismo energético normal',
    'El fósforo contribuye al mantenimiento de los huesos y los dientes en condiciones normales',
  ],
  zinc: [
    'El zinc contribuye al funcionamiento normal del sistema inmunitario',
    'El zinc contribuye al mantenimiento del cabello, la piel y las uñas en condiciones normales',
    'El zinc contribuye a la función cognitiva normal',
  ],
  cobre: [
    'El cobre contribuye al funcionamiento normal del sistema inmunitario',
    'El cobre contribuye a la pigmentación normal del cabello y de la piel',
    'El cobre contribuye a la protección de las células frente al daño oxidativo',
  ],
  selenio: [
    'El selenio contribuye al funcionamiento normal del sistema inmunitario',
    'El selenio contribuye al mantenimiento del cabello y las uñas en condiciones normales',
    'El selenio contribuye al funcionamiento normal de la tiroides',
  ],
  manganeso: [
    'El manganeso contribuye al metabolismo energético normal',
    'El manganeso contribuye al mantenimiento de los huesos en condiciones normales',
    'El manganeso contribuye a la protección de las células frente al daño oxidativo',
  ],
  yodo: [
    'El yodo contribuye a la función cognitiva normal',
    'El yodo contribuye a la producción normal de hormonas tiroideas y a la función tiroidea normal',
    'El yodo contribuye al metabolismo energético normal',
  ],
  cromo: [
    'El cromo contribuye al metabolismo normal de los macronutrientes',
    'El cromo contribuye a mantener niveles normales de glucosa en sangre',
  ],
  'vitamina-a': [
    'La vitamina A contribuye al mantenimiento de la visión en condiciones normales',
    'La vitamina A contribuye al mantenimiento de la piel en condiciones normales',
    'La vitamina A contribuye al funcionamiento normal del sistema inmunitario',
  ],
  'vitamina-b1': [
    'La tiamina (vitamina B1) contribuye al metabolismo energético normal',
    'La tiamina contribuye al funcionamiento normal del corazón',
    'La tiamina contribuye a la función psicológica normal',
  ],
  'vitamina-b2': [
    'La riboflavina (vitamina B2) ayuda a disminuir el cansancio y la fatiga',
    'La riboflavina contribuye al mantenimiento de la piel y de la visión en condiciones normales',
    'La riboflavina contribuye a la protección de las células frente al daño oxidativo',
  ],
  'vitamina-b3': [
    'La niacina (vitamina B3) ayuda a disminuir el cansancio y la fatiga',
    'La niacina contribuye al funcionamiento normal del sistema nervioso',
    'La niacina contribuye al mantenimiento de la piel en condiciones normales',
  ],
  'vitamina-b6': [
    'La vitamina B6 ayuda a disminuir el cansancio y la fatiga',
    'La vitamina B6 contribuye a la función psicológica normal',
    'La vitamina B6 contribuye al funcionamiento normal del sistema inmunitario',
  ],
  'vitamina-b9': [
    'El folato ayuda a disminuir el cansancio y la fatiga',
    'El folato contribuye al crecimiento de los tejidos maternos durante el embarazo',
    'El folato contribuye al funcionamiento normal del sistema inmunitario',
  ],
  'vitamina-b12': [
    'La vitamina B12 ayuda a disminuir el cansancio y la fatiga',
    'La vitamina B12 contribuye al funcionamiento normal del sistema nervioso',
    'La vitamina B12 contribuye al funcionamiento normal del sistema inmunitario',
  ],
  'vitamina-c': [
    'La vitamina C contribuye al funcionamiento normal del sistema inmunitario',
    'La vitamina C ayuda a disminuir el cansancio y la fatiga',
    'La vitamina C mejora la absorción del hierro',
  ],
  'vitamina-d': [
    'La vitamina D contribuye al mantenimiento de los huesos y los dientes en condiciones normales',
    'La vitamina D contribuye al funcionamiento normal de los músculos',
    'La vitamina D contribuye al funcionamiento normal del sistema inmunitario',
  ],
  'vitamina-e': ['La vitamina E contribuye a la protección de las células frente al daño oxidativo'],
  'vitamina-k': [
    'La vitamina K contribuye a la coagulación sanguínea normal',
    'La vitamina K contribuye al mantenimiento de los huesos en condiciones normales',
  ],
};

/** Mención obligatoria que acompaña a cualquier declaración de salud (art. 10.2 Reg. 1924/2006). */
export const MENCION_DIETA_VARIADA =
  'Solo tienen efecto en el marco de una dieta variada y equilibrada y de un estilo de vida saludable.';

export type Nivel = 'bajo' | 'medio' | 'alto';

/**
 * Semáforo por 100 g (sólidos) o 100 ml (bebidas). «bajo» coincide con el umbral legal de la
 * UE; «alto» es el criterio de la FSA británica, solo orientativo.
 */
export const SEMAFORO = {
  solido: {
    grasas: { bajo: 3, alto: 17.5 },
    saturadas: { bajo: 1.5, alto: 5 },
    azucares: { bajo: 5, alto: 22.5 },
    sal: { bajo: 0.3, alto: 1.5 },
  },
  liquido: {
    grasas: { bajo: 1.5, alto: 8.75 },
    saturadas: { bajo: 0.75, alto: 2.5 },
    azucares: { bajo: 2.5, alto: 11.25 },
    sal: { bajo: 0.3, alto: 0.75 },
  },
} as const;

export function nivel(valor: number | null, umbral: { bajo: number; alto: number }): Nivel | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  if (valor <= umbral.bajo) return 'bajo';
  if (valor > umbral.alto) return 'alto';
  return 'medio';
}

/** Factores de conversión de energía (Anexo XIV Reg. 1169/2011), kcal por gramo. */
export const KCAL_POR_GRAMO = { grasas: 9, hidratos: 4, proteinas: 4, fibra: 2, polialcoholes: 2.4, alcohol: 7 } as const;
