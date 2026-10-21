/**
 * Evaluación del asistente con el modelo de verdad: lanza cada caso de evals/casos.json con
 * el prompt y las herramientas de este módulo, ejecuta las herramientas en local y puntúa la
 * respuesta final con reglas fijas (herramienta usada + expresiones que deben o no aparecer).
 *
 * Cuesta dinero (unos 36 casos × 2-4 llamadas). Uso:
 *   ANTHROPIC_API_KEY=... node evals/ejecutar.ts [--catalogo ruta.json] [--solo id1,id2] [--umbral 0.9]
 * Variables opcionales: EVAL_MODELO (por defecto claude-opus-5-5; pon el mismo que use el
 * Worker), EVAL_ESFUERZO (low | medium | high; por defecto medium), EVAL_CONCURRENCIA (3).
 */

import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crearCatalogo, definicionesHerramientas, ejecutarHerramientaNutricion, PROMPT_NUTRICION } from '../src/index.ts';

interface Caso {
  id: string;
  categoria: string;
  pregunta: string;
  herramientas: string[];
  debe_incluir: string[];
  no_debe_incluir: string[];
}

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const MODELO = process.env.EVAL_MODELO ?? 'claude-opus-5-5';
const ESFUERZO = (process.env.EVAL_ESFUERZO ?? 'medium') as 'low' | 'medium' | 'high';
const CONCURRENCIA = Math.max(1, Math.min(8, Number(process.env.EVAL_CONCURRENCIA ?? 3)));
const UMBRAL = Number(opcion('--umbral') ?? 0.9);
const rutaCatalogo = opcion('--catalogo') ?? new URL('../test/fixtures/catalogo-muestra.json', import.meta.url).pathname;
const solo = opcion('--solo')?.split(',');

const catalogo = crearCatalogo(JSON.parse(readFileSync(rutaCatalogo, 'utf8')));
const casos = (JSON.parse(readFileSync(new URL('./casos.json', import.meta.url), 'utf8')) as { casos: Caso[] }).casos.filter(
  (c) => !solo || solo.includes(c.id),
);

/** Parecido al prompt del Worker: lo justo para que el contexto sea realista. */
const PROMPT_BASE = `Eres el asistente automático de atención al cliente de A Granel Madrid, una tienda online de alimentación a granel (agranelmadrid.com). Respondes en español de España, con frases cortas y trato cercano. Si el cliente necesita una persona: WhatsApp 711 292 081 o info@agranelmadrid.com.`;

const client = new Anthropic();
const tools = definicionesHerramientas(catalogo) as unknown as Anthropic.Beta.BetaTool[];

interface Resultado {
  id: string;
  categoria: string;
  ok: boolean;
  fallos: string[];
  herramientas: string[];
  respuesta: string;
  tokens: { entrada: number; salida: number; cache: number };
}

async function ejecutarCaso(caso: Caso): Promise<Resultado> {
  const mensajes: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: caso.pregunta }];
  const usadas: string[] = [];
  const tokens = { entrada: 0, salida: 0, cache: 0 };
  let respuesta = '';
  let rechazo = false;

  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const res = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: [
        { type: 'text', text: PROMPT_BASE },
        { type: 'text', text: PROMPT_NUTRICION, cache_control: { type: 'ephemeral' } },
      ],
      tools,
      messages: mensajes,
      output_config: { effort: ESFUERZO },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    tokens.entrada += res.usage.input_tokens;
    tokens.salida += res.usage.output_tokens;
    tokens.cache += res.usage.cache_read_input_tokens ?? 0;

    if (res.stop_reason === 'refusal') {
      rechazo = true;
      break;
    }
    mensajes.push({ role: 'assistant', content: res.content });
    const usos = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || usos.length === 0) {
      respuesta = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = usos.map((u) => {
      usadas.push(u.name);
      const r = ejecutarHerramientaNutricion(catalogo, u.name, u.input) ?? {
        contenido: JSON.stringify({ error: 'Herramienta desconocida.' }),
        esError: true,
      };
      return { type: 'tool_result', tool_use_id: u.id, content: r.contenido, is_error: r.esError };
    });
    mensajes.push({ role: 'user', content: resultados });
  }

  const fallos: string[] = [];
  if (rechazo) fallos.push('el modelo rechazó la petición');
  if (!respuesta && !rechazo) fallos.push('sin respuesta final (¿demasiadas vueltas de herramientas?)');
  if (caso.herramientas.length && !caso.herramientas.some((h) => usadas.includes(h))) {
    fallos.push(`no usó ${caso.herramientas.join(' ni ')}`);
  }
  for (const p of caso.debe_incluir) if (!new RegExp(p, 'iu').test(respuesta)) fallos.push(`falta /${p}/`);
  for (const p of caso.no_debe_incluir) if (new RegExp(p, 'iu').test(respuesta)) fallos.push(`incluye /${p}/`);

  return { id: caso.id, categoria: caso.categoria, ok: fallos.length === 0, fallos, herramientas: usadas, respuesta, tokens };
}

async function main() {
  console.log(`Modelo ${MODELO} · esfuerzo ${ESFUERZO} · ${casos.length} casos · catálogo ${catalogo.fichas.length} productos\n`);
  const resultados: Resultado[] = [];
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCIA }, async () => {
      while (siguiente < casos.length) {
        const caso = casos[siguiente++];
        try {
          const r = await ejecutarCaso(caso);
          resultados.push(r);
          console.log(`${r.ok ? '✔' : '✖'} ${r.id}${r.ok ? '' : ` → ${r.fallos.join('; ')}`}`);
        } catch (err) {
          const mensaje = err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err);
          resultados.push({ id: caso.id, categoria: caso.categoria, ok: false, fallos: [`error de API: ${mensaje}`], herramientas: [], respuesta: '', tokens: { entrada: 0, salida: 0, cache: 0 } });
          console.log(`✖ ${caso.id} → error de API: ${mensaje}`);
        }
      }
    }),
  );

  const aciertos = resultados.filter((r) => r.ok).length;
  const tasa = resultados.length ? aciertos / resultados.length : 0;
  const porCategoria = new Map<string, { ok: number; total: number }>();
  for (const r of resultados) {
    const c = porCategoria.get(r.categoria) ?? { ok: 0, total: 0 };
    c.total++;
    if (r.ok) c.ok++;
    porCategoria.set(r.categoria, c);
  }
  const tok = resultados.reduce((a, r) => ({ e: a.e + r.tokens.entrada, s: a.s + r.tokens.salida, c: a.c + r.tokens.cache }), { e: 0, s: 0, c: 0 });

  console.log(`\nResultado: ${aciertos}/${resultados.length} (${Math.round(tasa * 100)} %)`);
  for (const [cat, c] of porCategoria) console.log(`  ${cat}: ${c.ok}/${c.total}`);
  console.log(`Tokens: ${tok.e} de entrada (${tok.c} leídos de caché), ${tok.s} de salida.`);

  mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true });
  const fichero = new URL(`./resultados/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url);
  writeFileSync(fichero, JSON.stringify({ modelo: MODELO, esfuerzo: ESFUERZO, tasa, resultados }, null, 2));
  console.log(`Detalle: ${fichero.pathname}`);
  if (tasa < UMBRAL) process.exitCode = 1;
}

await main();
