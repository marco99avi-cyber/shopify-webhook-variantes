/**
 * Aditivos que conviene saber explicar. No es el catálogo completo de la UE (Reg. 1333/2008):
 * son los que más preguntan los clientes y los que llevan avisos u origen animal.
 */

export interface Aditivo {
  codigo: string;
  nombre: string;
  funcion: string;
  nota?: string;
  /** true = siempre animal; 'posible' = puede ser animal o vegetal según el fabricante. */
  origenAnimal?: true | 'posible';
  aviso?: string;
  /** Otros nombres con los que aparece en la etiqueta. */
  nombres?: string[];
}

const AVISO_AZOICOS = 'Puede tener efectos negativos sobre la actividad y la atención de los niños (mención obligatoria, Reg. 1333/2008).';

export const ADITIVOS: readonly Aditivo[] = [
  { codigo: 'e100', nombre: 'curcumina', funcion: 'colorante', nota: 'Colorante natural de la cúrcuma.' },
  { codigo: 'e101', nombre: 'riboflavina', funcion: 'colorante', nota: 'Es vitamina B2.' },
  { codigo: 'e102', nombre: 'tartrazina', funcion: 'colorante', aviso: AVISO_AZOICOS, nombres: ['tartrazina'] },
  { codigo: 'e104', nombre: 'amarillo de quinoleína', funcion: 'colorante', aviso: AVISO_AZOICOS },
  { codigo: 'e110', nombre: 'amarillo anaranjado S', funcion: 'colorante', aviso: AVISO_AZOICOS, nombres: ['amarillo ocaso'] },
  {
    codigo: 'e120',
    nombre: 'cochinilla, ácido carmínico, carmines',
    funcion: 'colorante',
    origenAnimal: true,
    nota: 'Se obtiene de un insecto: no es vegano.',
    nombres: ['carmin', 'cochinilla', 'acido carminico'],
  },
  { codigo: 'e122', nombre: 'azorrubina', funcion: 'colorante', aviso: AVISO_AZOICOS, nombres: ['azorrubina', 'carmoisina'] },
  { codigo: 'e124', nombre: 'rojo cochinilla A (Ponceau 4R)', funcion: 'colorante', aviso: AVISO_AZOICOS, nombres: ['ponceau'] },
  { codigo: 'e129', nombre: 'rojo allura AC', funcion: 'colorante', aviso: AVISO_AZOICOS },
  { codigo: 'e150a', nombre: 'caramelo natural', funcion: 'colorante', nota: 'Colorante; no aporta azúcar apreciable.' },
  { codigo: 'e150c', nombre: 'caramelo amónico', funcion: 'colorante' },
  { codigo: 'e150d', nombre: 'caramelo de sulfito amónico', funcion: 'colorante' },
  { codigo: 'e160a', nombre: 'carotenos', funcion: 'colorante' },
  { codigo: 'e162', nombre: 'rojo de remolacha', funcion: 'colorante' },
  { codigo: 'e163', nombre: 'antocianinas', funcion: 'colorante' },
  {
    codigo: 'e171',
    nombre: 'dióxido de titanio',
    funcion: 'colorante',
    nota: 'Prohibido como aditivo alimentario en la UE desde 2022 (Reg. (UE) 2022/63). Si lo ves en un alimento, es de fuera de la UE o antiguo.',
    nombres: ['dioxido de titanio'],
  },
  { codigo: 'e200', nombre: 'ácido sórbico', funcion: 'conservante' },
  { codigo: 'e202', nombre: 'sorbato potásico', funcion: 'conservante', nombres: ['sorbato potasico'] },
  { codigo: 'e211', nombre: 'benzoato sódico', funcion: 'conservante', nombres: ['benzoato sodico'] },
  { codigo: 'e220', nombre: 'dióxido de azufre', funcion: 'conservante', nota: 'Es un sulfito: alérgeno de declaración obligatoria.' },
  { codigo: 'e223', nombre: 'metabisulfito sódico', funcion: 'conservante', nota: 'Es un sulfito: alérgeno de declaración obligatoria.' },
  { codigo: 'e224', nombre: 'metabisulfito potásico', funcion: 'conservante', nota: 'Es un sulfito: alérgeno de declaración obligatoria.' },
  {
    codigo: 'e250',
    nombre: 'nitrito sódico',
    funcion: 'conservante',
    nota: 'Típico de embutidos y curados; la UE limita las cantidades permitidas.',
    nombres: ['nitrito sodico'],
  },
  { codigo: 'e252', nombre: 'nitrato potásico', funcion: 'conservante', nota: 'Típico de curados; uso limitado por la UE.' },
  { codigo: 'e270', nombre: 'ácido láctico', funcion: 'acidulante', nota: 'A pesar del nombre, no es leche ni lleva lactosa.' },
  { codigo: 'e296', nombre: 'ácido málico', funcion: 'acidulante' },
  { codigo: 'e300', nombre: 'ácido ascórbico', funcion: 'antioxidante', nota: 'Es vitamina C.' },
  { codigo: 'e306', nombre: 'extracto rico en tocoferoles', funcion: 'antioxidante', nota: 'Vitamina E; si viene de soja, está exento de declararse como alérgeno.' },
  {
    codigo: 'e322',
    nombre: 'lecitinas',
    funcion: 'emulgente',
    nota: 'Suele venir de soja o de girasol (a veces de huevo): si la etiqueta no lo dice, no se puede descartar soja.',
  },
  { codigo: 'e330', nombre: 'ácido cítrico', funcion: 'acidulante', nota: 'Muy común y seguro; se produce por fermentación.' },
  { codigo: 'e331', nombre: 'citratos de sodio', funcion: 'acidulante' },
  { codigo: 'e406', nombre: 'agar-agar', funcion: 'gelificante', nota: 'Vegetal, de algas rojas. Alternativa vegana a la gelatina.' },
  { codigo: 'e407', nombre: 'carragenanos', funcion: 'espesante', nota: 'De algas rojas.' },
  { codigo: 'e410', nombre: 'goma garrofín', funcion: 'espesante', nota: 'De la semilla de algarroba.' },
  { codigo: 'e412', nombre: 'goma guar', funcion: 'espesante' },
  { codigo: 'e414', nombre: 'goma arábiga', funcion: 'espesante / agente de recubrimiento', nota: 'Resina de acacia.' },
  { codigo: 'e415', nombre: 'goma xantana', funcion: 'espesante', nota: 'Muy usada en repostería sin gluten.' },
  { codigo: 'e422', nombre: 'glicerol', funcion: 'humectante' },
  { codigo: 'e440', nombre: 'pectinas', funcion: 'gelificante', nota: 'De fruta (manzana, cítricos).' },
  { codigo: 'e450', nombre: 'difosfatos', funcion: 'gasificante / estabilizante' },
  {
    codigo: 'e471',
    nombre: 'mono- y diglicéridos de ácidos grasos',
    funcion: 'emulgente',
    origenAnimal: 'posible',
    nota: 'Pueden ser de grasa vegetal o animal; solo el fabricante lo sabe.',
  },
  { codigo: 'e476', nombre: 'polirricinoleato de poliglicerol (PGPR)', funcion: 'emulgente', nota: 'Habitual en chocolate; de aceite de ricino.' },
  { codigo: 'e500', nombre: 'carbonatos de sodio (bicarbonato)', funcion: 'gasificante', nombres: ['bicarbonato sodico'] },
  { codigo: 'e503', nombre: 'carbonatos de amonio', funcion: 'gasificante' },
  { codigo: 'e542', nombre: 'fosfato de hueso', funcion: 'antiaglomerante', origenAnimal: true, nota: 'De hueso animal: no es vegano.' },
  { codigo: 'e551', nombre: 'dióxido de silicio', funcion: 'antiaglomerante' },
  {
    codigo: 'e621',
    nombre: 'glutamato monosódico',
    funcion: 'potenciador del sabor',
    nota: 'Autorizado y evaluado por la EFSA; aporta sodio.',
    nombres: ['glutamato monosodico'],
  },
  { codigo: 'e631', nombre: 'inosinato disódico', funcion: 'potenciador del sabor', origenAnimal: 'posible', nota: 'Puede obtenerse de carne o pescado.' },
  { codigo: 'e901', nombre: 'cera de abejas', funcion: 'agente de recubrimiento', origenAnimal: true, nota: 'No es vegano.', nombres: ['cera de abeja'] },
  { codigo: 'e903', nombre: 'cera de carnauba', funcion: 'agente de recubrimiento', nota: 'Vegetal (palmera).' },
  {
    codigo: 'e904',
    nombre: 'goma laca',
    funcion: 'agente de recubrimiento',
    origenAnimal: true,
    nota: 'Resina segregada por un insecto: no es vegana.',
    nombres: ['goma laca', 'shellac'],
  },
  { codigo: 'e920', nombre: 'L-cisteína', funcion: 'agente de tratamiento de harinas', origenAnimal: 'posible', nota: 'Puede obtenerse de plumas o pelo.' },
  { codigo: 'e1105', nombre: 'lisozima', funcion: 'conservante', origenAnimal: true, nota: 'Del huevo: alérgeno.' },
  { codigo: 'e1422', nombre: 'almidón modificado', funcion: 'espesante' },
  { codigo: 'e1520', nombre: 'propilenglicol', funcion: 'humectante / disolvente de aromas' },
];

export const ADITIVO_POR_CODIGO: ReadonlyMap<string, Aditivo> = new Map(ADITIVOS.map((a) => [a.codigo, a]));

/**
 * Ingredientes de origen animal que no son alérgenos (los alérgenos animales —leche, huevo,
 * pescado, crustáceos, moluscos— se detectan aparte).
 */
export const ORIGEN_ANIMAL: readonly string[] = [
  'miel', 'jalea real', 'propoleo', 'cera de abeja', 'gelatina', 'colageno', 'lanolina', 'carmin', 'cochinilla',
  'goma laca', 'cuajo', 'grasa animal', 'manteca de cerdo', 'sebo', 'tocino', 'carne', 'pollo', 'cerdo', 'ternera',
  'jamon', 'caldo de pollo', 'caldo de carne', 'vitamina d3',
];

export const EXCLUSIONES_ORIGEN_ANIMAL: readonly string[] = [
  'sabor a carne', 'aroma de carne', 'sabor carne', 'carne vegetal', 'carne de membrillo', 'gelatina vegetal',
  'miel de cana', 'miel de palma', 'pollo vegano', 'pollo vegetal', 'vitamina d3 vegana', 'vitamina d3 de liquen',
];
