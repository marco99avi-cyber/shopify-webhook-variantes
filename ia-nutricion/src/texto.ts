/**
 * Normalización y tokenización de texto en español.
 *
 * Todo el emparejamiento de términos (alérgenos, azúcares, aditivos, búsqueda en catálogo) pasa
 * por aquí, así que la regla es simple: el texto y los términos se normalizan con la misma
 * función. Así «Cacahuetes», «cacahuete» y «CACAHUETE» acaban siendo el mismo token.
 */

/** Signos que el tokenizador conserva. '.' marca fin de frase; ',' ':' y ';' cortan el alcance corto. */
export const PUNTUACION = new Set(['.', ',', ';', ':']);
export const FIN_DE_FRASE = new Set(['.', ';']);

/** Letras cirílicas y griegas que se confunden con latinas («s\u043Eja», con una o cirílica). */
const CONFUSABLES: Readonly<Record<string, string>> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
  '\u0456': 'i', '\u0458': 'j', '\u0455': 's', '\u0501': 'd', '\u0261': 'g', '\u04CF': 'l', '\u0410': 'A',
  '\u0415': 'E', '\u041E': 'O', '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X', '\u0406': 'I',
  '\u041A': 'K', '\u041C': 'M', '\u041D': 'H', '\u0412': 'B', '\u03BF': 'o', '\u03B1': 'a', '\u03B5': 'e',
  '\u03B9': 'i', '\u03BA': 'k', '\u03BD': 'v', '\u03C1': 'p', '\u03C4': 't',
};
const RE_CONFUSABLES = new RegExp(`[${Object.keys(CONFUSABLES).join('')}]`, 'g');
const HAY_CONFUSABLES = new RegExp(`[${Object.keys(CONFUSABLES).join('')}]`);

/**
 * Limpia texto que viene de fuera antes de analizarlo: compatibilidad Unicode (NFKC), sin
 * caracteres invisibles ni de control de dirección, y con homoglifos cirílicos/griegos pasados
 * a latín. Sin esto, «tri\u200Bgo» o «s\u043Eja» (con una o cirílica) esquivarían la detección.
 */
export function sanear(texto: string): string {
  return texto
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(RE_CONFUSABLES, (c) => (Object.hasOwn(CONFUSABLES, c) ? CONFUSABLES[c] : c));
}

/** ¿Tenía el texto caracteres invisibles u homoglifos? (posible intento de engañar al análisis) */
export function tieneCaracteresSospechosos(texto: string): boolean {
  return /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/.test(texto) || HAY_CONFUSABLES.test(texto);
}

/** Minúsculas, sin tildes, con los números E unificados («E-220», «E 220» → «e220»). */
export function normalizar(texto: string): string {
  return sanear(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/\be\s*[-‐–]?\s*(\d{3,4}[a-z]?)\b/g, 'e$1');
}

/**
 * Singular aproximado. No es un lematizador: solo necesita que singular y plural de los
 * términos que usamos caigan en el mismo token.
 *   nueces → nuez · altramuces → altramuz · mejillones → mejillon · azucares → azucar
 *   cereales → cereal · cacahuetes → cacahuete · carnes → carne · frutos → fruto
 */
export function singular(token: string): string {
  if (token.length <= 3 || /\d/.test(token)) return token;
  if (token.endsWith('ces') && token.length > 4) return token.slice(0, -3) + 'z';
  if (token.endsWith('es') && token.length > 4) {
    const antes = token.charAt(token.length - 3);
    const anterior = token.charAt(token.length - 4);
    if ('rlndjy'.includes(antes) && 'aeiou'.includes(anterior)) return token.slice(0, -2);
  }
  if (token.endsWith('s') && 'aeiou'.includes(token.charAt(token.length - 2))) return token.slice(0, -1);
  return token;
}

// Caché pequeña: una misma ficha se tokeniza varias veces (alérgenos, azúcares, aditivos…).
const CACHE_TOKENS = new Map<string, readonly string[]>();
const MAX_CACHE_TOKENS = 64;

/**
 * Tokens normalizados y en singular. Conserva la puntuación que delimita frases y alcances;
 * descarta paréntesis, porcentajes, asteriscos y demás símbolos. El array devuelto es de solo
 * lectura (se comparte entre llamadas).
 */
export function tokenizar(texto: string): readonly string[] {
  const enCache = CACHE_TOKENS.get(texto);
  if (enCache) return enCache;
  const norm = normalizar(texto).replace(/[!?\n\r]+/g, '.');
  const crudos = norm.match(/[a-z0-9]+|[.,;:]/g) ?? [];
  const tokens = Object.freeze(crudos.map((t) => (PUNTUACION.has(t) ? t : singular(t))));
  if (CACHE_TOKENS.size >= MAX_CACHE_TOKENS) CACHE_TOKENS.clear();
  CACHE_TOKENS.set(texto, tokens);
  return tokens;
}

// Las frases del diccionario son fijas: se tokenizan una sola vez.
const CACHE_FRASES = new Map<string, readonly string[]>();

/** Frase de diccionario → tokens, con la misma normalización que el texto. */
export function tokensDeFrase(frase: string): readonly string[] {
  let t = CACHE_FRASES.get(frase);
  if (!t) {
    t = Object.freeze(tokenizar(frase).filter((x) => !PUNTUACION.has(x)));
    CACHE_FRASES.set(frase, t);
  }
  return t;
}

/** ¿Empieza la frase `frase` en la posición `i` de `tokens`? */
export function coincideEn(tokens: readonly string[], i: number, frase: readonly string[]): boolean {
  if (i < 0 || i + frase.length > tokens.length) return false;
  for (let k = 0; k < frase.length; k++) {
    if (tokens[i + k] !== frase[k]) return false;
  }
  return true;
}

// Índice token → posiciones, uno por array de tokens (se libera solo con el array).
const INDICES = new WeakMap<readonly string[], Map<string, number[]>>();

function indice(tokens: readonly string[]): Map<string, number[]> {
  let ix = INDICES.get(tokens);
  if (!ix) {
    ix = new Map();
    for (let i = 0; i < tokens.length; i++) {
      const lista = ix.get(tokens[i]);
      if (lista) lista.push(i);
      else ix.set(tokens[i], [i]);
    }
    INDICES.set(tokens, ix);
  }
  return ix;
}

const NINGUNA: readonly number[] = Object.freeze([]);

/** Todas las posiciones donde aparece `frase`. */
export function buscarFrase(tokens: readonly string[], frase: readonly string[]): readonly number[] {
  if (frase.length === 0) return NINGUNA;
  const candidatas = indice(tokens).get(frase[0]);
  if (!candidatas) return NINGUNA;
  if (frase.length === 1) return candidatas;
  return candidatas.filter((i) => coincideEn(tokens, i, frase));
}

/** Palabras vacías para la búsqueda de productos por nombre. */
export const PALABRAS_VACIAS = new Set(
  [
    'de', 'del', 'la', 'el', 'lo', 'los', 'las', 'un', 'una', 'uno', 'y', 'e', 'o', 'u', 'a', 'al', 'en',
    'con', 'sin', 'por', 'para', 'que', 'se', 'su', 'mi', 'tu', 'me', 'te', 'le', 'es', 'son',
    'granel', 'madrid', 'tienda', 'producto', 'vuestro', 'vuestra', 'tenei', 'tienes', 'tiene',
    'hay', 'algo', 'cual', 'como', 'esta', 'este', 'eso', 'esto', 'muy', 'mas', 'pero',
  ].map(singular),
);

/** Tokens con significado para buscar por nombre (sin puntuación ni palabras vacías). */
export function tokensDeBusqueda(texto: string): string[] {
  return tokenizar(texto).filter((t) => !PUNTUACION.has(t) && !PALABRAS_VACIAS.has(t));
}

/** Recorta un texto a `max` caracteres sin partir palabras, para respuestas compactas. */
export function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf(' ', max - 1);
  return texto.slice(0, corte > max * 0.6 ? corte : max - 1).trimEnd() + '…';
}

/** Tildes de los términos del diccionario, para mostrarlos bien («azucar» → «azúcar»). */
const TILDES: Readonly<Record<string, string>> = {
  azucar: 'azúcar', almibar: 'almíbar', datil: 'dátil', mazapan: 'mazapán', praline: 'praliné', cuscus: 'cuscús',
  sesamo: 'sésamo', ajonjoli: 'ajonjolí', tahin: 'tahín', seitan: 'seitán', mani: 'maní', atun: 'atún',
  salmon: 'salmón', boqueron: 'boquerón', camaron: 'camarón', mejillon: 'mejillón', chipiron: 'chipirón',
  abulon: 'abulón', caseina: 'caseína', lactoalbumina: 'lactoalbúmina', requeson: 'requesón', kefir: 'kéfir',
  lacteo: 'lácteo', lactea: 'láctea', solido: 'sólido', ovoalbumina: 'ovoalbúmina', albumina: 'albúmina',
  crustaceo: 'crustáceo', dioxido: 'dióxido', anhidrido: 'anhídrido', castana: 'castaña', para: 'Pará',
  brasil: 'Brasil', cascara: 'cáscara', jamon: 'jamón', colageno: 'colágeno', propoleo: 'propóleo',
  glucosido: 'glucósido', proteina: 'proteína', necora: 'nécora', bigaro: 'bígaro', zamburina: 'zamburiña',
  judion: 'judión', limon: 'limón', jalea: 'jalea', confitado: 'confitado', cafe: 'café', te: 'té',
};

/** Término normalizado del diccionario → forma legible con tildes. */
export function mostrar(termino: string): string {
  return termino
    .split(' ')
    .map((p) => (Object.hasOwn(TILDES, p) ? TILDES[p] : p))
    .join(' ');
}
