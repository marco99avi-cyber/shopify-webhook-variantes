# ia-nutricion

El "cerebro" de composición, alérgenos y nutrición para el asistente de A Granel Madrid. Se enchufa al Worker de Cloudflare `agranel-chat` (no lo sustituye): le da cuatro herramientas, una sección de prompt y los datos reales de cada ficha.

Sin dependencias en tiempo de ejecución, sin red y sin secretos dentro del Worker.

## Por qué así y no "entrenando" el modelo

El modelo no se reentrena: se le da **datos estructurados y herramientas deterministas**. Es más fiable y se puede auditar:

- El modelo nunca contesta de memoria si un producto de la tienda lleva gluten. Consulta la ficha y recibe un veredicto ya calculado, con la frase de seguridad ya redactada.
- Si la ficha cambia en Shopify, la respuesta cambia en la siguiente generación del catálogo. No hay que reentrenar nada.
- Cada veredicto tiene un test. Si alguien rompe la lógica de gluten, los tests fallan antes del despliegue.

## Qué sabe hacer

| Pregunta del cliente | Qué hace |
|---|---|
| «¿Los copos de avena tienen gluten? Soy celíaca» | Ficha → «Lleva gluten (avena). No es apto para celíacos. La avena solo es apta si está certificada». |
| «¿El arroz basmati es sin gluten?» | «Por sus ingredientes no lleva gluten… no está certificado y se vende a granel: no te lo podemos garantizar». |
| «¿La pasta de trigo sarraceno lleva gluten?» | Avisa de que hay dos: la espiral (sin gluten) y el macarrón (lleva trigo duro). |
| «¿El matcha latte tiene azúcar?» | 50 g por 100 g, con azúcar de caña añadido. Distingue azúcares totales y añadidos. |
| «¿Qué tenéis sin gluten y con más proteína?» | Filtra el catálogo por alérgenos, gluten, azúcar, proteína, fibra, sal, kcal… |
| «Tomo Sintrom, ¿puedo tomar ginkgo?» | Precaución de la EMA: riesgo de sangrado, consulta con tu médico. |
| «¿La Nocilla tiene gluten? ¿Puedo hacer algo parecido?» | Analiza la lista típica (avisando de que es orientativa) y propone la versión casera con los productos de la tienda, con enlace. |
| El cliente pega una etiqueta | Alérgenos, gluten, azúcares añadidos, edulcorantes, aditivos con sus avisos legales (E-171 prohibido, azoicos, aspartamo, polialcoholes), si es vegano. |

Conocimiento incluido (todo con su fuente en el código):

- **14 alérgenos del Anexo II del Reg. 1169/2011**, con sinónimos reales, derivados exentos (jarabe de glucosa de trigo, aceite de soja refinado…) y falsos amigos sacados del catálogo: trigo sarraceno, «soja roja/verde» (adzuki/mungo), nuez moscada, leche de coco, manteca de cacao, mantequilla de cacahuete, ácido láctico.
- **Contexto de cada mención**: «contiene» vs «puede contener trazas» vs «sin gluten» vs «no es un fruto de cáscara».
- **Declaraciones nutricionales** del Reg. 1924/2006 calculadas desde la tabla, y **declaraciones de salud** del Reg. 432/2012 con la misma redacción que ya usa el tema.
- **«Sin gluten»** según el Reg. 828/2014 (≤ 20 mg/kg).
- **30 precauciones por ingrediente** (EFSA, EMA, AESAN): miel y bebés, regaliz e hipertensión, cumarina de la canela cassia, yodo de la kombu, hipérico e interacciones, alubias crudas, B12 de la espirulina, cafeína en el embarazo…

## Seguridad

- **Herramientas de solo lectura**, sin datos de clientes y sin red. Nada de lo que el modelo pida puede escribir en Shopify.
- **`strict: true`** en las cuatro herramientas, y además se valida todo en código (tipos, longitudes, enums, rangos). La entrada del modelo se trata como no confiable.
- **Texto del cliente = datos.** Las etiquetas pegadas se analizan de forma determinista y nunca se reenvían al modelo como instrucciones. Hay un test con una inyección dentro de una etiqueta.
- **Anti-evasión**: se limpian caracteres invisibles, homoglifos cirílicos y formas de ancho completo antes de analizar («trigo» con un espacio invisible dentro, «soja» con una «o» cirílica o «TRIGO» en letras de ancho completo se detectan igual).
- **Sin regex con retroceso** sobre texto del cliente (evita ReDoS).
- **Prudente por diseño**: ante la duda dice «puede contener»; nunca dice «apto para celíacos» de un producto a granel sin certificar; datos pendientes = no se afirma nada.
- **El token de Shopify no toca el Worker.** Solo lo usa el script que genera el catálogo, con permiso `read_products` y nada más. Nunca se imprime. Si algo falla, no sobrescribe el catálogo.
- Dependencias de desarrollo fijadas a versiones exactas con más de 2 semanas de antigüedad. Instala con `npm ci --ignore-scripts`.

## Integración en `agranel-chat`

1. Copia `src/` a `agranel-chat/src/nutricion/` y `scripts/construir-catalogo.ts` a `agranel-chat/scripts/`. Asegúrate de que el `tsconfig` del Worker tenga `"allowImportingTsExtensions": true` (con `noEmit`, que es lo normal con Wrangler).

2. Genera el catálogo (ver abajo) en `agranel-chat/src/data/catalogo-nutricional.json`.

3. En el Worker, fuera del handler:

   ```ts
   import datos from './data/catalogo-nutricional.json';
   import { crearCatalogo, definicionesHerramientas, ejecutarHerramientaNutricion, PROMPT_NUTRICION } from './nutricion/index.ts';

   const catalogo = crearCatalogo(datos);                 // ~10 ms en frío con 500 productos
   const herramientasNutricion = definicionesHerramientas(catalogo);
   ```

4. En la llamada a Claude, añade las herramientas y la sección de prompt (en un bloque fijo, para que la caché de prompt funcione):

   ```ts
   tools: [...herramientasActuales, ...herramientasNutricion],
   system: [
     { type: 'text', text: promptActual },
     { type: 'text', text: PROMPT_NUTRICION, cache_control: { type: 'ephemeral' } },
   ],
   ```

5. En el bucle donde el Worker ejecuta herramientas:

   ```ts
   for (const bloque of respuesta.content) {
     if (bloque.type !== 'tool_use') continue;
     const r = ejecutarHerramientaNutricion(catalogo, bloque.name, bloque.input);
     if (r) {
       resultados.push({ type: 'tool_result', tool_use_id: bloque.id, content: r.contenido, is_error: r.esError });
       continue;
     }
     // …aquí siguen las herramientas que ya tiene el Worker (pedidos, envíos, etc.)
   }
   ```

   Devuelve todos los `tool_result` de una vuelta en un solo mensaje `user`.

6. Opcional: las URL que devuelven las herramientas son `/products/<handle>`. Si el Worker ya pinta tarjetas de producto (evento `products`), puede usarlas para mostrar las de los productos citados.

7. Revisa el pie del widget (`snippets/ag-chat.liquid`): hoy dice que para gluten o alergias se escriba por WhatsApp. Con esto el asistente ya responde con prudencia, pero conviene dejar el WhatsApp para alergias graves y celiaquía.

## Generar el catálogo

Crea en Shopify una app personalizada con **solo** el permiso `read_products` y usa su token aquí. No reutilices el token del webhook de variantes, que tiene permisos de escritura.

```bash
npm ci --ignore-scripts
SHOPIFY_TIENDA=a-granel-madrid.myshopify.com SHOPIFY_TOKEN_LECTURA=shpat_xxx npm run catalogo
```

Genera:

- `data/catalogo-nutricional.json`: fichas publicadas en la web, más hechos precalculados para que el Worker arranque en frío en ~10 ms.
- `data/auditoria-catalogo.md`: fichas incoherentes o incompletas. Ejemplos reales que ya encuentra: sulfitos en ingredientes sin declarar como alérgeno, «sin azúcares añadidos» con chocolate en la lista, tablas con la fibra metida en los hidratos.

Regenéralo antes de cada despliegue o cuando cambien fichas. En `docs/ejemplo-github-action.yml` hay un ejemplo para hacerlo cada semana.

## Tests y evaluaciones

```bash
npm test            # 130 tests deterministas sobre 50 productos reales; no gastan nada
npm run typecheck
npm run evals       # 36 preguntas reales contra el modelo de verdad (cuesta tokens)
```

`npm run evals` necesita `ANTHROPIC_API_KEY`. Usa `EVAL_MODELO` con el mismo modelo que use el Worker (por defecto `claude-opus-5-5`). Activa los fallbacks del servidor ante rechazos del modelo (`fallbacks: "default"`). Cada caso exige que se use la herramienta correcta y comprueba lo que debe y no debe decir la respuesta. Añade preguntas reales del chat a `evals/casos.json` a medida que aparezcan.

## Mantenimiento

- **Nuevo alérgeno, sinónimo o falso amigo**: `src/conocimiento/alergenos.ts`, más un caso en `test/alergenos.test.ts`.
- **Nueva precaución**: `src/conocimiento/precauciones.ts`, con fuente y grupos afectados.
- **Si cambias la lógica de veredictos**: sube `VERSION_MOTOR` en `src/catalogo.ts` y regenera el catálogo. Los hechos de otra versión se ignoran solos.
