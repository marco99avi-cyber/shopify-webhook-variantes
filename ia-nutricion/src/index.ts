/**
 * ia-nutricion — conocimiento de composición, alérgenos y nutrición para el asistente de
 * A Granel Madrid. Sin dependencias en tiempo de ejecución, sin red, sin secretos: apto para
 * Cloudflare Workers.
 *
 * Uso mínimo en el Worker:
 *
 *   import datos from './data/catalogo-nutricional.json';
 *   import { crearCatalogo, definicionesHerramientas, ejecutarHerramientaNutricion, PROMPT_NUTRICION } from 'ia-nutricion';
 *
 *   const catalogo = crearCatalogo(datos);                  // una vez, fuera del handler
 *   const tools = [...misTools, ...definicionesHerramientas(catalogo)];
 *   const system = [miPrompt, PROMPT_NUTRICION];
 *   // en el bucle de herramientas:
 *   const r = ejecutarHerramientaNutricion(catalogo, bloque.name, bloque.input);
 *   if (r) toolResults.push({ type: 'tool_result', tool_use_id: bloque.id, content: r.contenido, is_error: r.esError });
 */

export {
  crearCatalogo,
  hechosDe,
  VERSION_MOTOR,
  type Catalogo,
  type Criterios,
  type DatosCatalogo,
  type Hechos,
  type Orden,
  type Resultado,
} from './catalogo.ts';
export { crearFicha, type Ficha, type ProductoCrudo, type VeredictoGluten } from './ficha.ts';
export { analizarExterno, buscarEnTienda, separarIngredientes, type AnalisisExterno } from './analizador.ts';
export {
  definicionesHerramientas,
  ejecutarHerramientaNutricion,
  esHerramientaNutricion,
  fichaParaModelo,
  NOMBRES_HERRAMIENTAS,
  type DefinicionHerramienta,
  type NombreHerramienta,
  type ResultadoHerramienta,
} from './herramientas.ts';
export { PROMPT_NUTRICION } from './prompt.ts';
export { auditarCatalogo, informeMarkdown, type Hallazgo } from './auditoria.ts';
export { detectarAlergenos, type ResultadoAlergenos } from './deteccion.ts';
export { leerNutricion, type Nutricion } from './nutricion.ts';
export { ALERGENOS, IDS_ALERGENOS, type AlergenoId } from './conocimiento/alergenos.ts';
