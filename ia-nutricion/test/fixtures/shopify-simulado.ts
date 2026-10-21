/**
 * Sustituye fetch por una Admin API de Shopify simulada (2 páginas) para probar el script de
 * catálogo sin red. Se carga con: node --import ./test/fixtures/shopify-simulado.ts …
 */
import { readFileSync } from 'node:fs';

const muestra = JSON.parse(readFileSync(new URL('./catalogo-muestra.json', import.meta.url), 'utf8')) as {
  productos: Array<{ handle: string; titulo: string; tipo?: string; etiquetas?: string[]; ingredientes?: string | null; alergenos?: string | null; nutricional?: string | null; gramosRacion?: number }>;
};

const nodos = muestra.productos.slice(0, 6).map((p) => ({
  handle: p.handle,
  title: p.titulo,
  productType: p.tipo ?? '',
  tags: ['ag-organizado', 'ia-metafields', ...(p.etiquetas ?? [])],
  isGiftCard: false,
  onlineStoreUrl: `https://agranelmadrid.com/products/${p.handle}`,
  ingredientes: p.ingredientes ? { value: p.ingredientes } : null,
  alergenos: p.alergenos ? { value: p.alergenos } : null,
  nutricional: p.nutricional ? { value: p.nutricional } : null,
  gramosRacion: p.gramosRacion ? { value: `${p.gramosRacion}.0` } : null,
  unidadRacion: p.gramosRacion ? { value: 'ración' } : null,
}));
nodos.push({ ...nodos[0], handle: 'tarjeta-regalo', title: 'Tarjeta regalo', isGiftCard: true });
nodos.push({ ...nodos[1], handle: 'borrador-oculto', title: 'Oculto', onlineStoreUrl: null as unknown as string });

let llamadas = 0;
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  llamadas++;
  const u = String(url);
  const cabeceras = new Headers(init?.headers);
  if (!/^https:\/\/[a-z0-9-]+\.myshopify\.com\/admin\/api\/\d{4}-\d{2}\/graphql\.json$/.test(u)) throw new Error(`URL inesperada: ${u}`);
  if (process.env.SIMULAR_401 === '1' || cabeceras.get('X-Shopify-Access-Token') !== process.env.SHOPIFY_TOKEN_LECTURA) {
    return new Response('{}', { status: 401 });
  }
  if (llamadas === 1) return new Response('{"errors":"slow down"}', { status: 429, headers: { 'retry-after': '0' } });
  const { variables } = JSON.parse(String(init?.body)) as { variables: { cursor: string | null } };
  const primera = variables.cursor === null;
  const pagina = primera ? nodos.slice(0, 4) : nodos.slice(4);
  return new Response(
    JSON.stringify({
      data: { products: { pageInfo: { hasNextPage: primera, endCursor: primera ? 'c1' : null }, nodes: pagina } },
      extensions: { cost: { throttleStatus: { currentlyAvailable: 1000, restoreRate: 50 } } },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}) as typeof fetch;
