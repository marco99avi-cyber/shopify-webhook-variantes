/**
 * Azúcares, polialcoholes y edulcorantes tal como aparecen en listas de ingredientes.
 *
 * Distinción clave que el asistente tiene que hacer bien:
 *  - «Azúcares» de la tabla nutricional = TODOS (los de la fruta, la leche… y los añadidos).
 *  - «Azúcares añadidos» = los que aparecen como ingrediente (azúcar, miel, siropes, zumos
 *    concentrados…). Un orejón puede tener 48 g de azúcares por 100 g sin llevar azúcar añadido.
 *  - «Sin azúcares añadidos» (Reg. 1924/2006): ni mono/disacáridos añadidos ni ningún
 *    alimento usado por su poder endulzante.
 */

export const AZUCARES_ANADIDOS: readonly string[] = [
  'azucar', 'sacarosa', 'glucosa', 'dextrosa', 'fructosa', 'maltosa', 'galactosa', 'trehalosa', 'isoglucosa',
  'jarabe', 'sirope', 'almibar', 'melaza', 'panela', 'mascabado', 'rapadura', 'miel', 'extracto de malta',
  'fruta confitada', 'confitado', 'caramelo', 'lactosa', 'dulce de leche', 'mermelada', 'zumo concentrado',
  'concentrado de zumo', 'pasta de datil', 'azucar invertido', 'agave',
];

export const EXCLUSIONES_AZUCAR: readonly string[] = [
  'azucar de abedul', 'azucar naturalmente presente', 'azucar son naturalmente presente',
  'azucar presente de forma natural', 'azucar propio', 'azucar de la fruta', 'azucar natural',
  'colorante caramelo', 'caramelo e150', 'caramelo e150a', 'caramelo e150b', 'caramelo e150c', 'caramelo e150d',
  'sabor caramelo', 'aroma de caramelo', 'aroma caramelo',
];

/** Términos tras los que «azúcar» no es añadido (nos quedamos en las 3 palabras siguientes). */
export const NATURALMENTE: readonly string[] = ['naturalmente', 'natural', 'intrinseco', 'propio'];

export interface Poliol {
  nombre: string;
  terminos: string[];
}

export const POLIALCOHOLES: readonly Poliol[] = [
  { nombre: 'sorbitol', terminos: ['sorbitol', 'e420'] },
  { nombre: 'manitol', terminos: ['manitol', 'e421'] },
  { nombre: 'isomalt', terminos: ['isomalt', 'e953'] },
  { nombre: 'maltitol', terminos: ['maltitol', 'e965'] },
  { nombre: 'lactitol', terminos: ['lactitol', 'e966'] },
  { nombre: 'xilitol', terminos: ['xilitol', 'azucar de abedul', 'e967'] },
  { nombre: 'eritritol', terminos: ['eritritol', 'e968'] },
];

export const EDULCORANTES: readonly Poliol[] = [
  { nombre: 'acesulfamo K', terminos: ['acesulfamo', 'e950'] },
  { nombre: 'aspartamo', terminos: ['aspartamo', 'e951'] },
  { nombre: 'ciclamato', terminos: ['ciclamato', 'e952'] },
  { nombre: 'sacarina', terminos: ['sacarina', 'e954'] },
  { nombre: 'sucralosa', terminos: ['sucralosa', 'e955'] },
  { nombre: 'taumatina', terminos: ['taumatina', 'e957'] },
  { nombre: 'neohesperidina DC', terminos: ['neohesperidina', 'e959'] },
  { nombre: 'glucósidos de esteviol (estevia)', terminos: ['estevia', 'stevia', 'glucosido de esteviol', 'e960'] },
  { nombre: 'neotamo', terminos: ['neotamo', 'e961'] },
  { nombre: 'advantamo', terminos: ['advantamo', 'e969'] },
];

/** Menciones obligatorias del Reglamento (UE) n.º 1169/2011, Anexo III. */
export const AVISO_POLIALCOHOLES = 'Un consumo excesivo puede producir efectos laxantes.';
export const AVISO_ASPARTAMO = 'Contiene una fuente de fenilalanina (importante para personas con fenilcetonuria).';

/** Ingredientes que casi siempre aportan azúcar añadido aunque no lo digan en su nombre. */
export const POSIBLE_AZUCAR: readonly string[] = ['chocolate', 'cobertura de chocolate', 'datil'];

/** Nombres de producto que son, en sí mismos, un azúcar (miel, sirope…). */
export const PRODUCTOS_AZUCAR: readonly string[] = [
  'miel', 'sirope', 'azucar', 'panela', 'melaza', 'jarabe', 'mascabado', 'rapadura', 'agave', 'dextrosa', 'fructosa',
];
