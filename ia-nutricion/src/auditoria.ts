/**
 * Auditoría de coherencia de las fichas. El asistente es tan fiable como los datos: estas
 * reglas buscan fichas que podrían llevar al cliente a error (o a un problema legal) y se
 * ejecutan cada vez que se regenera el catálogo.
 */

import { ALERGENOS, NOMBRE_ALERGENO } from './conocimiento/alergenos.ts';
import { type Catalogo } from './catalogo.ts';
import { sospechaAzucarOculto, type Ficha } from './ficha.ts';
import { tokenizar } from './texto.ts';

export type Gravedad = 'alta' | 'media' | 'baja';

export interface Hallazgo {
  handle: string;
  titulo: string;
  regla: string;
  gravedad: Gravedad;
  detalle: string;
}

const ORDEN: Record<Gravedad, number> = { alta: 0, media: 1, baja: 2 };

function reglas(f: Ficha): Array<Omit<Hallazgo, 'handle' | 'titulo'>> {
  const h: Array<Omit<Hallazgo, 'handle' | 'titulo'>> = [];
  const det = f.deteccion;
  const desdeFichaAlergenos = (id: (typeof ALERGENOS)[number]['id']) => {
    // Lo que dice el campo «alérgenos» por sí solo (sin unir con ingredientes).
    const soloIngredientes = det.desdeIngredientes.alergenos[id].estado;
    const unido = det.alergenos.alergenos[id].estado;
    return { soloIngredientes, unido };
  };

  if (!f.textos.alergenos) {
    h.push({ regla: 'falta-alergenos', gravedad: 'alta', detalle: 'La ficha no tiene información de alérgenos: el asistente no puede responder sobre gluten ni alergias.' });
  }
  if (!f.textos.ingredientes) {
    h.push({ regla: 'falta-ingredientes', gravedad: 'media', detalle: 'Sin lista de ingredientes: no se puede confirmar azúcar añadido, si es vegano ni aditivos.' });
  }
  if (!f.textos.nutricional) {
    h.push({ regla: 'falta-nutricional', gravedad: 'media', detalle: 'Sin información nutricional.' });
  } else if (!f.nutricion) {
    h.push({ regla: 'nutricional-ilegible', gravedad: 'media', detalle: 'La información nutricional no tiene un formato reconocible (energía y macronutrientes por 100 g).' });
  }

  if (det.alergenos.pendiente) {
    h.push({ regla: 'alergenos-pendientes', gravedad: 'alta', detalle: 'Alérgenos o composición «pendientes de confirmar con el proveedor». Mientras tanto el asistente lo trata como «puede contener».' });
  }

  // Alérgenos que aparecen en los ingredientes pero el campo «alérgenos» no recoge.
  if (f.textos.alergenos) {
    const soloFicha = f.textos.alergenos;
    const tokensFicha = ' ' + tokenizar(soloFicha).join(' ') + ' ';
    for (const def of ALERGENOS) {
      const { soloIngredientes } = desdeFichaAlergenos(def.id);
      if (soloIngredientes !== 'contiene' && soloIngredientes !== 'puede_contener') continue;
      if (def.id === 'gluten' && det.desdeIngredientes.alergenos.gluten.sinGlutenDeclarado) continue;
      const mencionado = [...def.terminos, ...(def.ambiguos ?? [])].some((t) => tokensFicha.includes(' ' + tokenizar(t).join(' ') + ' '));
      if (mencionado) continue;
      const terminos = det.desdeIngredientes.alergenos[def.id].terminos.join(', ');
      const ambiguo = soloIngredientes === 'puede_contener' && det.desdeIngredientes.alergenos[def.id].nota;
      h.push({
        regla: 'alergeno-no-declarado',
        gravedad: ambiguo ? 'media' : 'alta',
        detalle: ambiguo
          ? `Los ingredientes mencionan «${terminos}» sin decir su origen y el campo de alérgenos no habla de ${NOMBRE_ALERGENO[def.id].toLowerCase()}. Conviene especificarlo.`
          : `Los ingredientes indican ${NOMBRE_ALERGENO[def.id].toLowerCase()} («${terminos}») pero el campo de alérgenos no lo declara (Reg. 1169/2011, Anexo II).`,
      });
    }
  }

  if (f.azucar.incoherencia && !sospechaAzucarOculto(f.titulo, f.azucar.anadido, f.nutricion?.azucares ?? null)) {
    const lista = [...f.azucar.fuentes, ...f.azucar.posibles].join(', ');
    h.push({
      regla: 'sin-azucar-contradictorio',
      gravedad: 'alta',
      detalle: `Dice «sin azúcares añadidos» pero la lista incluye: ${lista}. Confirmar con el proveedor y corregir la ficha (Reg. 1924/2006).`,
    });
  }
  if (sospechaAzucarOculto(f.titulo, f.azucar.anadido, f.nutricion?.azucares ?? null)) {
    h.push({
      regla: 'azucar-sospechoso',
      gravedad: 'media',
      detalle: `Indica «sin azúcar añadido» con ${f.nutricion?.azucares} g de azúcares por 100 g. El arándano rojo es muy ácido: esas cifras son típicas de arándano infusionado con azúcar o zumo concentrado (que también cuenta como azúcar añadido). Confirmar con la ficha técnica del proveedor.`,
    });
  }

  const n = f.nutricion;
  if (n) {
    const suma = (n.grasas ?? 0) + (n.hidratos ?? 0) + (n.proteinas ?? 0) + (n.fibra ?? 0) + (n.sal ?? 0);
    if (suma > 105) {
      const pista = n.fibra ? ' Lo más probable es que los hidratos incluyan la fibra (formato de EE. UU.); en la UE la fibra va aparte.' : '';
      h.push({ regla: 'macros-imposibles', gravedad: 'alta', detalle: `Grasas + hidratos + proteínas + fibra + sal suman ${Math.round(suma)} g por 100 g.${pista}` });
    }
    if (n.saturadas !== null && n.grasas !== null && n.saturadas > n.grasas + 0.05) {
      h.push({ regla: 'macros-imposibles', gravedad: 'alta', detalle: `Saturadas (${n.saturadas} g) mayores que grasas totales (${n.grasas} g).` });
    }
    if (n.azucares !== null && n.hidratos !== null && n.azucares > n.hidratos + 0.05) {
      h.push({ regla: 'macros-imposibles', gravedad: 'alta', detalle: `Azúcares (${n.azucares} g) mayores que hidratos (${n.hidratos} g).` });
    }
    if (n.kcal !== null && n.kj !== null && n.kcal > 0) {
      const ratio = n.kj / n.kcal;
      if (Math.abs(ratio - 4.184) > 0.2) {
        h.push({ regla: 'energia-incoherente', gravedad: 'media', detalle: `kJ y kcal no cuadran (${n.kj} kJ / ${n.kcal} kcal; deberían diferir en un factor de 4,184).` });
      }
    }
    const calc = f.energia?.calculadas ?? null;
    if (n.kcal !== null && calc !== null && n.base !== 'bebida_preparada') {
      const dif = Math.abs(n.kcal - calc);
      if (dif > 40 && dif / Math.max(n.kcal, 1) > 0.2) {
        const pista =
          calc > n.kcal
            ? ' Suele pasar al copiar tablas de EE. UU. (hidratos que incluyen la fibra o factores de conversión distintos). En la UE la energía declarada debe calcularse con estos factores.'
            : '';
        h.push({
          regla: 'energia-incoherente',
          gravedad: 'media',
          detalle: `Declara ${n.kcal} kcal pero sus macronutrientes dan unas ${calc} kcal (factores del Anexo XIV del Reg. 1169/2011).${pista}`,
        });
      }
    }
  }

  const etiquetaVegano = f.etiquetas.includes('vegano');
  if (etiquetaVegano && f.vegano.estado === 'no') {
    h.push({ regla: 'vegano-contradictorio', gravedad: 'alta', detalle: `Marcado como vegano, pero: ${f.vegano.motivo}` });
  }
  if (f.etiquetas.includes('sin-gluten') && (f.gluten.veredicto === 'contiene' || f.gluten.veredicto === 'puede_contener')) {
    h.push({ regla: 'etiqueta-sin-gluten', gravedad: 'alta', detalle: `Etiqueta interna «sin-gluten», pero la ficha dice: ${f.gluten.resumen}` });
  }

  if (f.textos.alergenos && / coco /.test(' ' + tokenizar(f.textos.alergenos).join(' ') + ' ') && / fruto de cascara /.test(' ' + tokenizar(f.textos.alergenos).join(' ') + ' ')) {
    h.push({
      regla: 'coco-fruto-de-cascara',
      gravedad: 'baja',
      detalle: 'Declara el coco como fruto de cáscara. No está en la lista legal del Anexo II; avisar es prudente, pero conviene redactarlo como «el coco no es un alérgeno de declaración obligatoria, aunque algunas personas alérgicas a frutos secos reaccionan».',
    });
  }

  return h;
}

/** Lo que no es alimento no necesita ficha nutricional (molinillos, tarros…). */
const NO_ALIMENTOS = new Set(['accesorios', 'accesorio']);

export function auditarCatalogo(cat: Catalogo): Hallazgo[] {
  const salida: Hallazgo[] = [];
  for (const f of cat.fichas) {
    if (NO_ALIMENTOS.has((f.tipo ?? '').trim().toLowerCase())) continue;
    for (const r of reglas(f)) salida.push({ handle: f.handle, titulo: f.titulo, ...r });
  }
  return salida.sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad] || a.regla.localeCompare(b.regla) || a.titulo.localeCompare(b.titulo, 'es'));
}

const TITULOS_REGLA: Record<string, string> = {
  'alergeno-no-declarado': 'Alérgeno en ingredientes que no se declara',
  'alergenos-pendientes': 'Alérgenos pendientes de confirmar',
  'falta-alergenos': 'Sin información de alérgenos',
  'sin-azucar-contradictorio': '«Sin azúcares añadidos» que no cuadra con los ingredientes',
  'etiqueta-sin-gluten': 'Etiqueta «sin-gluten» que no cuadra',
  'vegano-contradictorio': 'Marcado vegano con ingredientes animales',
  'macros-imposibles': 'Tabla nutricional imposible',
  'azucar-sospechoso': 'Azúcar sospechoso para un «sin azúcar añadido»',
  'energia-incoherente': 'Energía que no cuadra con los macronutrientes',
  'falta-ingredientes': 'Sin lista de ingredientes',
  'falta-nutricional': 'Sin información nutricional',
  'nutricional-ilegible': 'Información nutricional ilegible',
  'coco-fruto-de-cascara': 'Coco declarado como fruto de cáscara',
};

export function informeMarkdown(hallazgos: readonly Hallazgo[], meta: { productos: number; generado?: string | null }): string {
  const lineas: string[] = [];
  const cuenta = (g: Gravedad) => hallazgos.filter((x) => x.gravedad === g).length;
  lineas.push('# Auditoría de fichas nutricionales', '');
  lineas.push(`Productos revisados: ${meta.productos}${meta.generado ? ` · Catálogo generado: ${meta.generado}` : ''}`, '');
  lineas.push(`- Gravedad alta: ${cuenta('alta')}`, `- Gravedad media: ${cuenta('media')}`, `- Gravedad baja: ${cuenta('baja')}`, '');
  const porRegla = new Map<string, Hallazgo[]>();
  for (const x of hallazgos) porRegla.set(x.regla, [...(porRegla.get(x.regla) ?? []), x]);
  for (const [regla, xs] of porRegla) {
    lineas.push(`## ${TITULOS_REGLA[regla] ?? regla} (${xs.length}) · gravedad ${xs[0].gravedad}`, '');
    for (const x of xs) lineas.push(`- **${x.titulo}** (\`${x.handle}\`): ${x.detalle}`);
    lineas.push('');
  }
  return lineas.join('\n');
}
