import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const simulado = fileURLToPath(new URL('./fixtures/shopify-simulado.ts', import.meta.url));

function ejecutar(env: Record<string, string>, salida: string) {
  return spawnSync(process.execPath, ['--import', simulado, 'scripts/construir-catalogo.ts', '--salida', salida], {
    cwd: raiz,
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('scripts/construir-catalogo.ts (Shopify simulado)', () => {
  it('pagina, reintenta el 429, filtra tarjetas regalo y no publicados, y audita', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
    const salida = join(dir, 'catalogo.json');
    const r = ejecutar({ SHOPIFY_TIENDA: 'tienda-prueba.myshopify.com', SHOPIFY_TOKEN_LECTURA: 'shpat_prueba_secreto' }, salida);
    assert.equal(r.status, 0, r.stderr);
    const datos = JSON.parse(readFileSync(salida, 'utf8'));
    assert.equal(datos.productos.length, 6);
    assert.ok(!datos.productos.some((p: { handle: string }) => p.handle === 'tarjeta-regalo' || p.handle === 'borrador-oculto'));
    assert.ok(!datos.productos.some((p: { etiquetas: string[] }) => p.etiquetas.some((e) => /^(ag-|ia-)/.test(e))));
    assert.equal(datos.productos[0].gramosRacion, 40);
    assert.equal(datos.version, '1');
    assert.ok(datos.productos.every((p: { hechos?: { g: string } }) => typeof p.hechos?.g === 'string'), 'hechos precalculados');
    assert.ok(existsSync(join(dir, 'auditoria-catalogo.md')));
    assert.ok(!r.stdout.includes('shpat_prueba_secreto') && !r.stderr.includes('shpat_prueba_secreto'), 'el token no se imprime');
  });

  it('se niega a arrancar sin token o con un dominio que no es de Shopify', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
    assert.notEqual(ejecutar({ SHOPIFY_TIENDA: 'tienda-prueba.myshopify.com' }, join(dir, 'a.json')).status, 0);
    assert.notEqual(ejecutar({ SHOPIFY_TIENDA: 'evil.example.com', SHOPIFY_TOKEN_LECTURA: 'x' }, join(dir, 'b.json')).status, 0);
    assert.ok(!existsSync(join(dir, 'a.json')) && !existsSync(join(dir, 'b.json')));
  });

  it('token rechazado → error claro, sin catálogo y sin filtrar el token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
    const salida = join(dir, 'c.json');
    const r = ejecutar({ SHOPIFY_TIENDA: 'tienda-prueba.myshopify.com', SHOPIFY_TOKEN_LECTURA: 'shpat_revocado', SIMULAR_401: '1' }, salida);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /read_products/);
    assert.ok(!existsSync(salida));
    assert.ok(!r.stderr.includes('shpat_revocado'));
  });
});
