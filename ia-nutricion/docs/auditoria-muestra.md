# Auditoría de fichas nutricionales (muestra de 50 productos reales, 21/10/2026)

> Muestra para validar el auditor, no el catálogo completo. El informe completo lo genera `npm run catalogo` en `data/auditoria-catalogo.md`.

Productos revisados: 50 · Catálogo generado: 2026-10-21T19:30:00Z

- Gravedad alta: 6
- Gravedad media: 11
- Gravedad baja: 1

## Alérgeno en ingredientes que no se declara (1) · gravedad alta

- **Albaricoque Deshidratado** (`albaricoque-deshidratado-sin-azucar-a-granel-en-madrid`): Los ingredientes indican dióxido de azufre y sulfitos (>10 mg/kg) («sulfito») pero el campo de alérgenos no lo declara (Reg. 1169/2011, Anexo II).

## Alérgenos pendientes de confirmar (2) · gravedad alta

- **Aroma de Carne** (`aroma-de-carne-a-granel-en-madrid`): Alérgenos o composición «pendientes de confirmar con el proveedor». Mientras tanto el asistente lo trata como «puede contener».
- **Arroz Basmati con Cúrcuma y Jengibre Ecológico** (`arroz-basmati-con-curcuma-y-jengibre-ecologico-a-granel-en-madrid`): Alérgenos o composición «pendientes de confirmar con el proveedor». Mientras tanto el asistente lo trata como «puede contener».

## Sin información de alérgenos (1) · gravedad alta

- **Proteína con Creatina, Cacao y Vitaminas** (`proteina-con-creatina-cacao-y-vitaminas-a-granel`): La ficha no tiene información de alérgenos: el asistente no puede responder sobre gluten ni alergias.

## Tabla nutricional imposible (1) · gravedad alta

- **Lino Marrón** (`lino-marron-a-granel-en-madrid`): Grasas + hidratos + proteínas + fibra + sal suman 116 g por 100 g. Lo más probable es que los hidratos incluyan la fibra (formato de EE. UU.); en la UE la fibra va aparte.

## «Sin azúcares añadidos» que no cuadra con los ingredientes (1) · gravedad alta

- **Muesli Crujiente con Chocolate Ecológico** (`muesli-crujiente-con-chocolate-ecologico-a-granel-en-madrid`): Dice «sin azúcares añadidos» pero la lista incluye: chocolate. Confirmar con el proveedor y corregir la ficha (Reg. 1924/2006).

## Azúcar sospechoso para un «sin azúcar añadido» (1) · gravedad media

- **Arándanos Deshidratados** (`arandanos-deshidratados-a-granel`): Indica «sin azúcar añadido» con 65 g de azúcares por 100 g. El arándano rojo es muy ácido: esas cifras son típicas de arándano infusionado con azúcar o zumo concentrado (que también cuenta como azúcar añadido). Confirmar con la ficha técnica del proveedor.

## Energía que no cuadra con los macronutrientes (3) · gravedad media

- **Canela Cassia** (`canela-cassia-a-granel-en-madrid`): Declara 247 kcal pero sus macronutrientes dan unas 351 kcal (factores del Anexo XIV del Reg. 1169/2011). Suele pasar al copiar tablas de EE. UU. (hidratos que incluyen la fibra o factores de conversión distintos). En la UE la energía declarada debe calcularse con estos factores.
- **Canela Ceylán Molida** (`canela-ceylan-molida-a-granel-en-madrid`): Declara 250 kcal pero sus macronutrientes dan unas 351 kcal (factores del Anexo XIV del Reg. 1169/2011). Suele pasar al copiar tablas de EE. UU. (hidratos que incluyen la fibra o factores de conversión distintos). En la UE la energía declarada debe calcularse con estos factores.
- **Espirulina** (`espirulina-a-granel`): Declara 290 kcal pero sus macronutrientes dan unas 395 kcal (factores del Anexo XIV del Reg. 1169/2011). Suele pasar al copiar tablas de EE. UU. (hidratos que incluyen la fibra o factores de conversión distintos). En la UE la energía declarada debe calcularse con estos factores.

## Sin lista de ingredientes (5) · gravedad media

- **Anacardo Crudo** (`anacardo-crudo-a-granel-en-madrid`): Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.
- **Arroz Konjac** (`arroz-konjac-a-granel-en-madrid`): Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.
- **Caldo de Verduras (Vegano)** (`caldo-de-verduras-vegano-a-granel-en-madrid`): Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.
- **Canela Cassia** (`canela-cassia-a-granel-en-madrid`): Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.
- **Cobertura de Chocolate con Leche** (`cobertura-de-chocolate-con-leche-a-granel-en-madrid`): Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.

## Sin información nutricional (2) · gravedad media

- **Nuez Moscada Molida** (`nuez-moscada-molida`): Sin información nutricional.
- **Proteína con Creatina, Cacao y Vitaminas** (`proteina-con-creatina-cacao-y-vitaminas-a-granel`): Sin información nutricional.

## Coco declarado como fruto de cáscara (1) · gravedad baja

- **Harina de Coco** (`harina-de-coco-a-granel-en-madrid`): Declara el coco como fruto de cáscara. No está en la lista legal del Anexo II; avisar es prudente, pero conviene redactarlo como «el coco no es un alérgeno de declaración obligatoria, aunque algunas personas alérgicas a frutos secos reaccionan».
