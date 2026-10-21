/**
 * Los 14 alérgenos de declaración obligatoria del Anexo II del Reglamento (UE) n.º 1169/2011,
 * con los nombres con los que aparecen de verdad en etiquetas en español.
 *
 * Cada entrada tiene:
 *  - terminos: si aparecen, el alérgeno está (salvo negación o exclusión).
 *  - ambiguos: indican que PUEDE estar (origen sin especificar, p. ej. «lecitina»).
 *  - exclusiones: frases que contienen un término pero no son el alérgeno («trigo sarraceno»,
 *    «leche de coco», «nuez moscada», «soja roja»). Salen de errores reales del catálogo.
 *  - exentos: derivados que el propio Anexo II excluye («jarabe de glucosa a base de trigo»).
 *
 * Criterio de seguridad: ante la duda, el sistema dice «puede contener», nunca «no contiene».
 */

export type AlergenoId =
  | 'gluten'
  | 'crustaceos'
  | 'huevo'
  | 'pescado'
  | 'cacahuete'
  | 'soja'
  | 'leche'
  | 'frutos_cascara'
  | 'apio'
  | 'mostaza'
  | 'sesamo'
  | 'sulfitos'
  | 'altramuces'
  | 'moluscos';

export interface DefinicionAlergeno {
  id: AlergenoId;
  nombre: string;
  terminos: string[];
  ambiguos?: string[];
  exclusionesAmbiguos?: string[];
  exclusiones?: string[];
  exentos?: string[];
  notaExentos?: string;
  /** Nota por término ambiguo (clave = el término tal cual aparece en `ambiguos`). */
  notasAmbiguos?: Record<string, string>;
  reactividadCruzada?: string;
  nota?: string;
}

export const ALERGENOS: readonly DefinicionAlergeno[] = [
  {
    id: 'gluten',
    nombre: 'Cereales que contienen gluten',
    terminos: [
      'gluten', 'trigo', 'espelta', 'escanda', 'kamut', 'khorasan', 'centeno', 'cebada', 'avena',
      'triticale', 'tritordeum', 'malta', 'seitan', 'bulgur', 'freekeh', 'farro', 'cuscus', 'cous cous',
      'pan rallado',
    ],
    exclusiones: [
      'trigo sarraceno', 'trigo negro', 'cuscus de maiz', 'cous cous de maiz', 'cuscus de quinoa',
      'cous cous de quinoa', 'cuscus de arroz', 'cous cous de arroz', 'cuscus de mijo', 'cous cous de mijo',
      'cuscus de garbanzo', 'cous cous de garbanzo', 'cuscus de lenteja', 'cous cous de lenteja',
    ],
    exentos: [
      'jarabe de glucosa de trigo', 'jarabe de glucosa trigo', 'dextrosa de trigo', 'dextrosa trigo',
      'maltodextrina de trigo', 'maltodextrina trigo', 'jarabe de glucosa de cebada', 'jarabe de glucosa cebada',
    ],
    notaExentos:
      'Jarabes de glucosa, dextrosa y maltodextrinas a base de trigo o cebada están exentos (Anexo II): el proceso elimina el gluten.',
    nota:
      'El trigo sarraceno (alforfón) no es trigo y no tiene gluten. La avena se declara como cereal con gluten salvo que esté certificada «sin gluten». Espelta, kamut y tritordeum son trigos o híbridos de trigo.',
  },
  {
    id: 'crustaceos',
    nombre: 'Crustáceos',
    terminos: [
      'crustaceo', 'gamba', 'langostino', 'camaron', 'cangrejo', 'langosta', 'bogavante', 'cigala', 'necora',
      'centollo', 'percebe', 'krill', 'quisquilla', 'carabinero', 'buey de mar',
    ],
    reactividadCruzada:
      'Quien es alérgico a crustáceos puede reaccionar también a moluscos o a ácaros (proteína común: tropomiosina).',
  },
  {
    id: 'huevo',
    nombre: 'Huevos',
    terminos: ['huevo', 'ovoalbumina', 'albumina', 'lisozima', 'e1105', 'yema', 'mayonesa', 'merengue', 'ovoproducto'],
  },
  {
    id: 'pescado',
    nombre: 'Pescado',
    terminos: [
      'pescado', 'anchoa', 'boqueron', 'atun', 'bonito', 'bacalao', 'merluza', 'salmon', 'sardina', 'caballa',
      'arenque', 'abadejo', 'surimi', 'katsuobushi', 'ictiocola', 'colatura',
    ],
  },
  {
    id: 'cacahuete',
    nombre: 'Cacahuetes',
    terminos: ['cacahuete', 'mani', 'arachis'],
    reactividadCruzada:
      'El cacahuete es una legumbre: algunas personas alérgicas reaccionan también a altramuz (muy documentado), fenogreco, guisante o garbanzo.',
    nota: 'El aceite de cacahuete no está exento: también se declara.',
  },
  {
    id: 'soja',
    nombre: 'Soja',
    terminos: ['soja', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'shoyu', 'natto', 'okara', 'yuba'],
    ambiguos: ['lecitina', 'e322', 'brote de soja'],
    exclusionesAmbiguos: [
      'lecitina de girasol', 'lecitina girasol', 'lecitina de colza', 'lecitina colza', 'lecitina de soja', 'lecitina soja',
      'lecitina de huevo', 'lecitina huevo', 'e322 soja', 'e322 girasol', 'e322 de soja', 'e322 de girasol',
    ],
    notasAmbiguos: {
      lecitina: 'La lecitina (E-322) puede venir de soja o de girasol: si la etiqueta no lo dice, no se puede descartar soja.',
      e322: 'La lecitina (E-322) puede venir de soja o de girasol: si la etiqueta no lo dice, no se puede descartar soja.',
      'brote de soja': 'Los «brotes de soja» del súper suelen ser de judía mungo, pero no siempre: si eres alérgico, compruébalo.',
    },
    exclusiones: ['soja roja', 'soja verde'],
    exentos: [
      'aceite de soja refinado', 'aceite refinado de soja', 'aceite de soja totalmente refinado',
      'grasa de soja refinada', 'tocoferol de soja', 'tocoferol soja', 'fitosterol de soja', 'fitosterol soja',
      'ester de fitostanol de soja',
    ],
    notaExentos:
      'El aceite de soja totalmente refinado, los tocoferoles y los fitosteroles de soja están exentos (Anexo II).',
    nota: '«Soja roja» es judía adzuki y «soja verde» es judía mungo: no son soja.',
  },
  {
    id: 'leche',
    nombre: 'Leche y derivados (incluida la lactosa)',
    terminos: [
      'leche', 'lactosa', 'lactosuero', 'caseina', 'caseinato', 'lactoalbumina', 'lactoglobulina', 'mantequilla',
      'nata', 'queso', 'yogur', 'yogurt', 'kefir', 'requeson', 'ghee', 'lacteo', 'proteina lactea', 'solido lacteo',
      'grasa lactea', 'cuajada', 'mozzarella', 'parmesano', 'ricotta', 'mascarpone', 'burrata', 'feta', 'suero de leche',
    ],
    exclusiones: [
      'leche de coco', 'leche de almendra', 'leche de avena', 'leche de arroz', 'leche de soja', 'leche de anacardo',
      'leche de avellana', 'leche de chufa', 'leche vegetal', 'leche de tigre', 'mantequilla de cacahuete',
      'mantequilla de cacao', 'mantequilla de karite', 'mantequilla de almendra', 'mantequilla de anacardo',
      'mantequilla vegetal', 'queso vegano', 'queso vegetal', 'yogur de soja', 'yogur de coco', 'yogur vegetal',
      'kefir de agua', 'nata vegetal', 'nata de soja', 'nata de coco', 'nata de avena',
    ],
    nota:
      '«Sin lactosa» no es «sin leche»: la proteína de la leche sigue ahí. Ácido láctico (E-270) y fermentos lácticos no son leche. Leche de coco, manteca de cacao y bebidas vegetales tampoco.',
  },
  {
    id: 'frutos_cascara',
    nombre: 'Frutos de cáscara',
    terminos: [
      'almendra', 'avellana', 'nuez', 'anacardo', 'pistacho', 'pacana', 'pecana', 'macadamia', 'nuez de brasil',
      'castana de para', 'castana de brasil', 'fruto de cascara', 'mazapan', 'praline', 'gianduja', 'marzipan',
    ],
    ambiguos: ['fruto seco'],
    notasAmbiguos: { 'fruto seco': '«Frutos secos» sin especificar puede incluir frutos de cáscara (y a veces cacahuete).' },
    exclusiones: ['nuez moscada', 'nuez de cola', 'nuez de coco'],
    nota:
      'Legalmente son solo almendra, avellana, nuez, anacardo, pacana, nuez de Brasil, pistacho y macadamia. Coco, piñón, castaña y nuez moscada no están en la lista, aunque algunas personas alérgicas reaccionan al coco o al piñón.',
    reactividadCruzada: 'Es frecuente reaccionar a varios frutos de cáscara a la vez.',
  },
  {
    id: 'apio',
    nombre: 'Apio',
    terminos: ['apio', 'apionabo', 'sal de apio'],
  },
  {
    id: 'mostaza',
    nombre: 'Mostaza',
    terminos: ['mostaza', 'sinapis'],
  },
  {
    id: 'sesamo',
    nombre: 'Granos de sésamo',
    terminos: ['sesamo', 'ajonjoli', 'tahin', 'tahini', 'tahina', 'gomasio', 'gomashio', 'halva', 'halwa'],
  },
  {
    id: 'sulfitos',
    nombre: 'Dióxido de azufre y sulfitos (>10 mg/kg)',
    terminos: [
      'sulfito', 'bisulfito', 'metabisulfito', 'dioxido de azufre', 'anhidrido sulfuroso', 'sulfuroso', 'e220', 'e221',
      'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228',
    ],
    nota:
      'Típicos en orejones, pasas claras, vino, vinagre y frutas deshidratadas de color vivo. Se declaran por encima de 10 mg/kg.',
  },
  {
    id: 'altramuces',
    nombre: 'Altramuces',
    terminos: ['altramuz', 'lupino', 'lupin'],
    reactividadCruzada: 'Reacción cruzada frecuente con el cacahuete.',
  },
  {
    id: 'moluscos',
    nombre: 'Moluscos',
    terminos: [
      'molusco', 'mejillon', 'almeja', 'ostra', 'berberecho', 'vieira', 'zamburina', 'navaja', 'calamar', 'sepia',
      'pulpo', 'chipiron', 'caracol', 'bigaro', 'abulon', 'salsa de ostra',
    ],
    reactividadCruzada: 'Reacción cruzada posible con crustáceos.',
  },
];

export const IDS_ALERGENOS: readonly AlergenoId[] = ALERGENOS.map((a) => a.id);

export const NOMBRE_ALERGENO: Readonly<Record<AlergenoId, string>> = Object.fromEntries(
  ALERGENOS.map((a) => [a.id, a.nombre]),
) as Record<AlergenoId, string>;

export function esAlergenoId(valor: unknown): valor is AlergenoId {
  return typeof valor === 'string' && (IDS_ALERGENOS as readonly string[]).includes(valor);
}
