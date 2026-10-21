/**
 * Descarga de Shopify las fichas nutricionales de los productos publicados y genera:
 *   data/catalogo-nutricional.json  → lo que se empaqueta con el Worker
 *   data/auditoria-catalogo.md      → fichas incoherentes o incompletas para revisar
 *
 * Uso (Node 22.18+):
 *   SHOPIFY_TIENDA=a-granel-madrid.myshopify.com \
 *   SHOPIFY_TOKEN_LECTURA=shpat_... \
 *   node scripts/construir-catalogo.ts [--salida data/catalogo-nutricional.json]
 *
 * Seguridad:
 *  - Usa un token de una app personalizada con SOLO el permiso `read_products`. No reutilices
 *    el token con permisos de escritura del webhook de variantes.
 *  - El token solo se lee de la variable de entorno; nunca se imprime ni se escribe en disco.
 *  - Solo habla con *.myshopify.com por HTTPS. Si algo falla, sale con error y no deja un
 *    catálogo a medias (escribe a un temporal y renombra).
 *  - El JSON resultante solo contiene información que ya es pública en las fichas.
 */

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auditarCatalogo, informeMarkdown } from '../src/auditoria.ts';
import { crearCatalogo, VERSION_MOTOR, type DatosCatalogo } from '../src/catalogo.ts';
import { type ProductoCrudo } from '../src/ficha.ts';

const TIENDA = process.env.SHOPIFY_TIENDA ?? 'a-granel-madrid.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN_LECTURA ?? '';
const VERSION_API = process.env.SHOPIFY_API_VERSION ?? '2026-07';

const args = process.argv.slice(2);
const salidaIdx = args.indexOf('--salida');
const SALIDA = resolve(salidaIdx >= 0 && args[salidaIdx + 1] ? args[salidaIdx + 1] : 'data/catalogo-nutricional.json');
const INFORME = resolve(dirname(SALIDA), 'auditoria-catalogo.md');

function fallar(mensaje: string): never {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(TIENDA)) fallar('SHOPIFY_TIENDA debe ser un dominio *.myshopify.com.');
if (!/^\d{4}-\d{2}$/.test(VERSION_API)) fallar('SHOPIFY_API_VERSION no tiene formato AAAA-MM.');
if (!TOKEN) fallar('Falta SHOPIFY_TOKEN_LECTURA (token de app personalizada con solo read_products).');

const CONSULTA = `query Catalogo($cursor: String) {
  products(first: 100, after: $cursor, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title productType tags isGiftCard onlineStoreUrl
      ingredientes: metafield(namespace: "custom", key: "ingredientes") { value }
      alergenos: metafield(namespace: "custom", key: "alergenos") { value }
      nutricional: metafield(namespace: "custom", key: "nutricional") { value }
      gramosRacion: metafield(namespace: "custom", key: "gramos_por_racion") { value }
      unidadRacion: metafield(namespace: "custom", key: "unidad_racion") { value }
    }
  }
}`;

interface Nodo {
  handle: string;
  title: string;
  productType: string | null;
  tags: string[];
  isGiftCard: boolean;
  onlineStoreUrl: string | null;
  ingredientes: { value: string } | null;
  alergenos: { value: string } | null;
  nutricional: { value: string } | null;
  gramosRacion: { value: string } | null;
  unidadRacion: { value: string } | null;
}

interface Respuesta {
  data?: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Nodo[] } };
  errors?: Array<{ message: string }>;
  extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pedir(cursor: string | null): Promise<Respuesta> {
  const url = `https://${TIENDA}/admin/api/${VERSION_API}/graphql.json`;
  for (let intento = 0; intento < 5; intento++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
        body: JSON.stringify({ query: CONSULTA, variables: { cursor } }),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
    } catch {
      await esperar(2 ** intento * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) fallar(`Shopify rechazó el token (${res.status}). ¿Tiene read_products?`);
    if (res.status === 429 || res.status >= 500) {
      await esperar(Number(res.headers.get('retry-after') ?? 0) * 1000 || 2 ** intento * 1000);
      continue;
    }
    if (!res.ok) fallar(`Shopify respondió ${res.status}.`);
    const json = (await res.json()) as Respuesta;
    if (json.errors?.length) {
      if (json.errors.some((e) => /throttled/i.test(e.message))) {
        await esperar(2 ** intento * 1000);
        continue;
      }
      fallar(`Error de GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
    }
    return json;
  }
  fallar('Shopify no respondió tras varios intentos.');
}

function aProducto(n: Nodo): ProductoCrudo {
  const gramos = n.gramosRacion?.value ? Number.parseFloat(n.gramosRacion.value) : null;
  return {
    handle: n.handle,
    titulo: n.title,
    tipo: n.productType || null,
    etiquetas: n.tags.filter((t) => !/^(ag-|ia-|bf-|revisar)/.test(t)),
    ingredientes: n.ingredientes?.value ?? null,
    alergenos: n.alergenos?.value ?? null,
    nutricional: n.nutricional?.value ?? null,
    gramosRacion: gramos !== null && Number.isFinite(gramos) ? gramos : null,
    unidadRacion: n.unidadRacion?.value ?? null,
  };
}

async function main() {
  const productos: ProductoCrudo[] = [];
  let cursor: string | null = null;
  let paginas = 0;
  do {
    const r = await pedir(cursor);
    const p = r.data?.products;
    if (!p) fallar('Respuesta sin datos de productos.');
    for (const n of p.nodes) {
      if (n.isGiftCard || !n.onlineStoreUrl) continue; // solo lo que se vende en la web
      productos.push(aProducto(n));
    }
    cursor = p.pageInfo.hasNextPage ? p.pageInfo.endCursor : null;
    paginas++;
    const t = r.extensions?.cost?.throttleStatus;
    if (t && t.currentlyAvailable < 200) await esperar(1000);
    if (paginas > 100) fallar('Demasiadas páginas: ¿bucle de paginación?');
  } while (cursor);

  if (productos.length === 0) fallar('No ha llegado ningún producto: no sobrescribo el catálogo.');

  const base: DatosCatalogo = { generado: new Date().toISOString(), tienda: TIENDA.replace('.myshopify.com', ''), productos };
  const catalogo = crearCatalogo(base);
  const hallazgos = auditarCatalogo(catalogo);
  // Hechos precalculados: el Worker filtra sin calcular fichas al arrancar.
  const hechos = new Map(catalogo.hechos().map((h) => [h.handle, h.hechos]));
  const datos: DatosCatalogo = {
    ...base,
    version: VERSION_MOTOR,
    productos: productos.map((p) => ({ ...p, hechos: hechos.get(p.handle) })),
  };

  mkdirSync(dirname(SALIDA), { recursive: true });
  const tmp = `${SALIDA}.tmp`;
  writeFileSync(tmp, JSON.stringify(datos, null, 1) + '\n');
  renameSync(tmp, SALIDA);
  writeFileSync(INFORME, informeMarkdown(hallazgos, { productos: catalogo.total, generado: datos.generado }));

  const cuenta = (g: string) => hallazgos.filter((h) => h.gravedad === g).length;
  console.log(`✔ ${catalogo.total} productos → ${SALIDA}`);
  console.log(`  Auditoría: ${cuenta('alta')} altas, ${cuenta('media')} medias, ${cuenta('baja')} bajas → ${INFORME}`);
}

await main();
