/**
 * Audita un catálogo ya generado sin llamar a Shopify.
 *   node scripts/auditar.ts [data/catalogo-nutricional.json] [--salida informe.md]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { auditarCatalogo, informeMarkdown } from '../src/auditoria.ts';
import { crearCatalogo, type DatosCatalogo } from '../src/catalogo.ts';

const args = process.argv.slice(2);
const salidaIdx = args.indexOf('--salida');
const salida = salidaIdx >= 0 ? args[salidaIdx + 1] : null;
const entrada = args.find((a, i) => !a.startsWith('--') && i !== salidaIdx + 1) ?? 'data/catalogo-nutricional.json';

const datos = JSON.parse(readFileSync(entrada, 'utf8')) as DatosCatalogo;
const catalogo = crearCatalogo(datos);
const informe = informeMarkdown(auditarCatalogo(catalogo), { productos: catalogo.fichas.length, generado: datos.generado ?? null });
if (salida) writeFileSync(salida, informe);
else console.log(informe);
