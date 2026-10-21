/**
 * Análisis de productos que NO vende la tienda: el cliente pega la etiqueta (o el asistente
 * la reconstruye de conocimiento general, y lo dice) y aquí se saca, de forma determinista:
 * alérgenos, gluten, azúcares añadidos, edulcorantes, aditivos, si es vegano, precauciones,
 * y con qué productos de la tienda se puede hacer algo parecido en casa.
 *
 * El texto del cliente es DATOS: nunca se ejecuta ni se reenvía como instrucción.
 */

import { ALERGENOS, NOMBRE_ALERGENO, type AlergenoId } from './conocimiento/alergenos.ts';
import { analizarAditivos, analizarAzucares, precaucionesPara, type AditivoDetectado, type PrecaucionAplicable } from './composicion.ts';
import { type Catalogo } from './catalogo.ts';
import { detectarAlergenos } from './deteccion.ts';
import {
  azucarDe,
  resumenAlergenos,
  veganoDe,
  veredictoGluten,
  type AlergenoFicha,
  type AzucarFicha,
  type Ficha,
  type Gluten,
} from './ficha.ts';
import { declaracionesNutricionales, leerNutricion, niveles, type Niveles, type Nutricion } from './nutricion.ts';
import { mostrar, sanear, tieneCaracteresSospechosos, tokenizar } from './texto.ts';

const GENERICOS = new Set(
  [
    'agua', 'aroma', 'aromas', 'aroma natural', 'emulgente', 'emulgentes', 'conservante', 'conservantes', 'antioxidante',
    'antioxidantes', 'acidulante', 'corrector de acidez', 'espesante', 'espesantes', 'estabilizante', 'estabilizantes',
    'colorante', 'colorantes', 'gasificante', 'gasificantes', 'gelificante', 'humectante', 'potenciador del sabor',
    'agente de recubrimiento', 'antiaglomerante', 'edulcorante', 'edulcorantes', 'especias', 'sal',
  ].map((s) => s.toLowerCase()),
);

const NO_ES_INGREDIENTE = /^(puede contener|contiene|elaborado|fabricado|envasado|trazas|alergenos|alérgenos|informaci|conservar|consumir|ingredientes?\s*$|valores|energ)/i;

/** Lista de ingredientes de primer nivel: «harina de trigo (60 %), azúcar, emulgentes (lecitina de soja)». */
export function separarIngredientes(texto: string): Array<{ nombre: string; detalle: string | null }> {
  const limpio = sanear(texto).replace(/^\s*ingredientes?\s*:\s*/i, '');
  const piezas: string[] = [];
  let actual = '';
  let profundidad = 0;
  const chars = [...limpio];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '(' || c === '[') profundidad++;
    if (c === ')' || c === ']') profundidad = Math.max(0, profundidad - 1);
    // «7,4 %» o «1.5 g» no separan ingredientes.
    const decimal = (c === ',' || c === '.') && /\d/.test(chars[i - 1] ?? '') && /\d/.test(chars[i + 1] ?? '');
    if (profundidad === 0 && !decimal && (c === ',' || c === ';' || c === '.' || c === '\n')) {
      piezas.push(actual);
      actual = '';
      continue;
    }
    actual += c;
  }
  piezas.push(actual);

  const salida: Array<{ nombre: string; detalle: string | null }> = [];
  for (const p of piezas) {
    const sinPct = p.replace(/\d+(?:[.,]\d+)?\s*%/g, '').replace(/[*_]/g, '').trim();
    if (!sinPct || NO_ES_INGREDIENTE.test(sinPct)) continue;
    const dentro = /[([]([^)\]]*)[)\]]/.exec(sinPct);
    const nombre = sinPct.replace(/[([][^)\]]*[)\]]/g, '').replace(/\s+/g, ' ').replace(/[:\s]+$/, '').trim().toLowerCase();
    // Solo cosas con pinta de ingrediente: así no se reenvían frases largas del cliente al modelo.
    if (!nombre || nombre.length > 80 || nombre.split(' ').length > 7 || !/^[\p{L}\p{N}\s'\u2019.\-/]+$/u.test(nombre)) continue;
    salida.push({ nombre, detalle: dentro?.[1]?.trim() || null });
    if (salida.length >= 40) break;
  }
  return salida;
}

export interface CoincidenciaTienda {
  ingrediente: string;
  productos: Array<{
    producto: string;
    url: string;
    gluten: Ficha['gluten']['veredicto'];
    alergenos: string[];
    conflicto: string[];
  }>;
}

/** Busca en el catálogo cada ingrediente; marca los que chocan con los alérgenos a evitar. */
export function buscarEnTienda(
  cat: Catalogo,
  ingredientes: readonly string[],
  evitar: readonly AlergenoId[] = [],
): { encontrados: CoincidenciaTienda[]; sinEquivalente: string[] } {
  const encontrados: CoincidenciaTienda[] = [];
  const sinEquivalente: string[] = [];
  for (const crudo of ingredientes) {
    const ing = crudo.trim();
    if (!ing || GENERICOS.has(ing.toLowerCase())) continue;
    const res = cat.buscarIngrediente(ing, 2);
    if (!res.length) {
      sinEquivalente.push(ing);
      continue;
    }
    encontrados.push({
      ingrediente: ing,
      productos: res.map(({ ficha }) => ({
        producto: ficha.titulo,
        url: ficha.url,
        gluten: ficha.gluten.veredicto,
        alergenos: ficha.alergenos.map((a) => `${a.estado === 'contiene' ? 'contiene' : 'puede contener'} ${a.nombre.toLowerCase()}`),
        conflicto: ficha.alergenos.filter((a) => evitar.includes(a.id)).map((a) => a.nombre.toLowerCase()),
      })),
    });
  }
  return { encontrados, sinEquivalente };
}

export interface AnalisisExterno {
  nombre: string | null;
  gluten: Gluten;
  alergenos: AlergenoFicha[];
  alergenosResumen: string;
  notasAlergenos: string[];
  azucar: AzucarFicha;
  nutricion: Nutricion | null;
  niveles: Niveles | null;
  declaraciones: string[];
  vegano: Ficha['vegano'];
  aditivos: AditivoDetectado[];
  aditivosSinFicha: string[];
  precauciones: PrecaucionAplicable[];
  ingredientes: string[];
  enTienda: CoincidenciaTienda[];
  sinEquivalenteEnTienda: string[];
  textoSospechoso: boolean;
  avisos: string[];
}

export function analizarExterno(
  entrada: { nombre: string | null; ingredientes: string; tablaNutricional: string | null; textoSospechoso?: boolean },
  cat: Catalogo | null,
): AnalisisExterno {
  const nombre = entrada.nombre ? sanear(entrada.nombre).trim() : null;
  const ingredientes = sanear(entrada.ingredientes);
  const tabla = entrada.tablaNutricional ? sanear(entrada.tablaNutricional) : null;
  // Quien llama puede haber saneado ya el texto: entonces nos pasa si venía camuflado.
  const sospechoso =
    entrada.textoSospechoso === true ||
    [entrada.nombre, entrada.ingredientes, entrada.tablaNutricional].some((t) => !!t && tieneCaracteresSospechosos(t));

  const det = detectarAlergenos(ingredientes);
  const certificado = / sin gluten /.test(` ${tokenizar(`${nombre ?? ''} ${ingredientes}`).join(' ')} `) && det.alergenos.gluten.estado !== 'contiene';
  const gluten = veredictoGluten(det, { hayDatos: true, certificado, esTienda: false });

  const alergenos: AlergenoFicha[] = ALERGENOS.flatMap((def) => {
    const d = det.alergenos[def.id];
    if (d.estado !== 'contiene' && d.estado !== 'puede_contener') return [];
    if (def.id === 'gluten' && (d.sinGlutenDeclarado || gluten.veredicto === 'declara_sin_gluten')) return [];
    return [{ id: def.id, nombre: NOMBRE_ALERGENO[def.id], estado: d.estado, terminos: d.terminos.map(mostrar), nota: d.nota }];
  });
  const notasAlergenos = [
    ...new Set(
      ALERGENOS.map((def) => det.alergenos[def.id].nota).filter((n): n is string => !!n),
    ),
  ];

  const nutricion = leerNutricion(tabla);
  const azucares = analizarAzucares(ingredientes);
  const { detectados: aditivos, codigosDesconocidos } = analizarAditivos(ingredientes);
  const lista = separarIngredientes(ingredientes);
  const nombresIngredientes = lista.map((i) => i.nombre);
  // Sin alérgenos «a evitar»: aquí no sabemos los del cliente (para eso, buscar_ingredientes_en_tienda).
  const enTienda = cat ? buscarEnTienda(cat, nombresIngredientes) : null;

  const avisos = [
    'Análisis automático del texto aportado: la etiqueta del envase y el fabricante mandan.',
    'Las recetas de marca cambian: si es para una alergia, comprueba siempre el envase que tienes en la mano.',
  ];
  if (sospechoso) {
    avisos.push('El texto traía caracteres invisibles o letras de otros alfabetos camufladas: se han normalizado, pero conviene revisarlo con la etiqueta original.');
  }
  if (!nutricion && tabla) avisos.push('No he podido leer la tabla nutricional: revisa el formato (valores por 100 g).');

  return {
    nombre,
    gluten,
    alergenos,
    alergenosResumen: resumenAlergenos(alergenos, det, true, false),
    notasAlergenos,
    azucar: azucarDe(nutricion, azucares, true, null),
    nutricion,
    niveles: nutricion ? niveles(nutricion) : null,
    declaraciones: nutricion ? declaracionesNutricionales(nutricion) : [],
    vegano: veganoDe(det, ingredientes, nombre ?? '', aditivos, false),
    aditivos,
    aditivosSinFicha: codigosDesconocidos,
    precauciones: precaucionesPara(`${nombre ?? ''}. ${ingredientes}`, nombre),
    ingredientes: nombresIngredientes,
    enTienda: enTienda?.encontrados ?? [],
    sinEquivalenteEnTienda: enTienda?.sinEquivalente ?? [],
    textoSospechoso: sospechoso,
    avisos,
  };
}
