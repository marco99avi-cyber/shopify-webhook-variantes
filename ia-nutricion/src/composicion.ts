/**
 * Análisis de la lista de ingredientes más allá de los alérgenos: azúcares añadidos,
 * edulcorantes, aditivos, origen animal y precauciones por ingrediente.
 */

import { ADITIVO_POR_CODIGO, ADITIVOS, EXCLUSIONES_ORIGEN_ANIMAL, ORIGEN_ANIMAL, type Aditivo } from './conocimiento/aditivos.ts';
import {
  AVISO_ASPARTAMO,
  AVISO_POLIALCOHOLES,
  AZUCARES_ANADIDOS,
  EDULCORANTES,
  EXCLUSIONES_AZUCAR,
  NATURALMENTE,
  POLIALCOHOLES,
  POSIBLE_AZUCAR,
} from './conocimiento/azucares.ts';
import { PRECAUCIONES, type Precaucion } from './conocimiento/precauciones.ts';
import { marcadorPrevio } from './deteccion.ts';
import { PUNTUACION, buscarFrase, tokenizar, tokensDeFrase } from './texto.ts';

// Las listas del diccionario son constantes: se tokenizan una vez por lista.
const LISTAS = new WeakMap<readonly string[], ReadonlyArray<readonly [string, readonly string[]]>>();
function tokenizada(frases: readonly string[]): ReadonlyArray<readonly [string, readonly string[]]> {
  let l = LISTAS.get(frases);
  if (!l) {
    l = frases.map((f) => [f, tokensDeFrase(f)] as const);
    LISTAS.set(frases, l);
  }
  return l;
}

function rangos(tokens: readonly string[], frases: readonly string[]): Array<[number, number]> {
  const r: Array<[number, number]> = [];
  for (const [, ft] of tokenizada(frases)) {
    for (const p of buscarFrase(tokens, ft)) r.push([p, p + ft.length]);
  }
  return r;
}

const solapa = (rs: ReadonlyArray<[number, number]>, a: number, b: number) => rs.some(([x, y]) => a < y && b > x);

interface Encontrado {
  frase: string;
  pos: number;
  fin: number;
  marcador: ReturnType<typeof marcadorPrevio>;
}

function encontrar(tokens: readonly string[], frases: readonly string[], exclusiones: readonly string[] = []): Encontrado[] {
  const excl = exclusiones.length ? rangos(tokens, exclusiones) : [];
  const salida: Encontrado[] = [];
  for (const [f, ft] of tokenizada(frases)) {
    for (const p of buscarFrase(tokens, ft)) {
      const fin = p + ft.length;
      if (solapa(excl, p, fin)) continue;
      salida.push({ frase: f, pos: p, fin, marcador: marcadorPrevio(tokens, p) });
    }
  }
  return salida;
}

function siguientes(tokens: readonly string[], desde: number, n: number): string[] {
  const s: string[] = [];
  for (let k = desde; k < tokens.length && s.length < n; k++) {
    if (PUNTUACION.has(tokens[k])) break;
    s.push(tokens[k]);
  }
  return s;
}

export interface Azucares {
  /** Ingredientes que son azúcar añadido («azúcar de caña», «miel», «sirope»). */
  anadidos: string[];
  /** Pueden aportar azúcar añadido («chocolate», «puede contener azúcar añadido»). */
  posibles: string[];
  polialcoholes: string[];
  edulcorantes: string[];
  /** El texto declara «sin azúcar(es) añadido(s)» o «sin endulzar». */
  declaraSinAnadidos: boolean;
  avisos: string[];
}

export function analizarAzucares(texto: string | null | undefined): Azucares {
  const tokens = tokenizar(texto ?? '');
  const unido = ' ' + tokens.join(' ') + ' ';
  const anadidos = new Set<string>();
  const posibles = new Set<string>();

  for (const e of encontrar(tokens, AZUCARES_ANADIDOS, EXCLUSIONES_AZUCAR)) {
    if (e.marcador === 'negado') continue;
    if (siguientes(tokens, e.fin, 3).some((t) => NATURALMENTE.includes(t))) continue;
    if (e.marcador === 'puede_contener') posibles.add(e.frase);
    else anadidos.add(e.frase);
  }
  if (/ zumo( [a-z0-9]+){0,3} concentrado /.test(unido)) anadidos.add('zumo concentrado');

  for (const e of encontrar(tokens, POSIBLE_AZUCAR)) {
    if (e.marcador === 'negado') continue;
    const despues = siguientes(tokens, e.fin, 4);
    const sinAzucar = despues.includes('100') || (despues.includes('sin') && despues.includes('azucar'));
    if (!sinAzucar) posibles.add(e.frase === 'cobertura de chocolate' ? 'chocolate' : e.frase);
  }

  const polialcoholes = POLIALCOHOLES.filter((p) => encontrar(tokens, p.terminos).some((e) => e.marcador !== 'negado')).map(
    (p) => p.nombre,
  );
  const edulcorantes = EDULCORANTES.filter((p) => encontrar(tokens, p.terminos).some((e) => e.marcador !== 'negado')).map(
    (p) => p.nombre,
  );

  const avisos: string[] = [];
  if (polialcoholes.length) avisos.push(AVISO_POLIALCOHOLES);
  if (edulcorantes.includes('aspartamo')) avisos.push(AVISO_ASPARTAMO);

  return {
    anadidos: [...anadidos],
    posibles: [...posibles].filter((p) => !anadidos.has(p)),
    polialcoholes,
    edulcorantes,
    declaraSinAnadidos: / (sin|no contiene) azucar anadid/.test(unido) || / sin endulzar /.test(unido),
    avisos,
  };
}

export interface AditivoDetectado {
  codigo: string;
  nombre: string;
  funcion: string;
  nota?: string;
  aviso?: string;
  origenAnimal?: true | 'posible';
}

export function analizarAditivos(texto: string | null | undefined): { detectados: AditivoDetectado[]; codigosDesconocidos: string[] } {
  const tokens = tokenizar(texto ?? '');
  const vistos = new Map<string, Aditivo>();
  const desconocidos = new Set<string>();

  for (const t of tokens) {
    if (/^e\d{3,4}[a-z]?$/.test(t)) {
      const a = ADITIVO_POR_CODIGO.get(t) ?? ADITIVO_POR_CODIGO.get(t.replace(/[a-z]$/, ''));
      if (a) vistos.set(a.codigo, a);
      else desconocidos.add(t.toUpperCase().replace(/^E/, 'E-'));
    }
  }
  for (const a of ADITIVOS) {
    if (vistos.has(a.codigo) || !a.nombres) continue;
    if (encontrar(tokens, a.nombres).some((e) => e.marcador !== 'negado')) vistos.set(a.codigo, a);
  }

  return {
    detectados: [...vistos.values()].map(({ codigo, nombre, funcion, nota, aviso, origenAnimal }) => ({
      codigo: codigo.toUpperCase().replace(/^E/, 'E-'),
      nombre,
      funcion,
      nota,
      aviso,
      origenAnimal,
    })),
    codigosDesconocidos: [...desconocidos],
  };
}

/** Ingredientes de origen animal que no son alérgenos (miel, gelatina, carmín…). */
export function ingredientesAnimales(texto: string | null | undefined): string[] {
  const tokens = tokenizar(texto ?? '');
  const s = new Set<string>();
  for (const e of encontrar(tokens, ORIGEN_ANIMAL, EXCLUSIONES_ORIGEN_ANIMAL)) {
    if (e.marcador !== 'negado') s.add(e.frase);
  }
  return [...s];
}

export interface PrecaucionAplicable {
  id: string;
  titulo: string;
  texto: string;
  nivel: Precaucion['nivel'];
  grupos: Precaucion['grupos'];
  fuente: string;
}

/** Precauciones que aplican a un texto (nombre del producto + ingredientes). */
export function precaucionesPara(texto: string | null | undefined, titulo?: string | null): PrecaucionAplicable[] {
  const tokens = tokenizar(texto ?? '');
  const tokensTitulo = tokenizar(titulo ?? texto ?? '');
  const salida: PrecaucionAplicable[] = [];
  for (const p of PRECAUCIONES) {
    const donde = p.soloEnTitulo ? tokensTitulo : tokens;
    const hay = encontrar(donde, p.terminos, p.exclusiones ?? []).some((e) => e.marcador !== 'negado');
    if (!hay) continue;
    if (p.siNoAparece && encontrar(tokens, p.siNoAparece).length > 0) continue;
    salida.push({ id: p.id, titulo: p.titulo, texto: p.texto, nivel: p.nivel, grupos: p.grupos, fuente: p.fuente });
  }
  return salida;
}
