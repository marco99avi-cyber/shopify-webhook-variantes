/**
 * Precauciones por ingrediente, con fuente. Redacción prudente: informa y deriva al
 * profesional sanitario; nunca diagnostica ni promete efectos.
 *
 * nivel 'importante' → el asistente lo menciona siempre que hable de ese producto para
 *   alguien de un grupo afectado (embarazo, niños, medicación…) o cuando pregunten por seguridad.
 * nivel 'info' → solo si viene al caso.
 */

export type Grupo =
  | 'general'
  | 'embarazo'
  | 'lactancia'
  | 'bebes'
  | 'ninos'
  | 'medicacion'
  | 'hipertension'
  | 'tiroides'
  | 'diabetes'
  | 'alergia'
  | 'higado'
  | 'inmunodeprimidos';

export interface Precaucion {
  id: string;
  titulo: string;
  texto: string;
  nivel: 'importante' | 'info';
  grupos: Grupo[];
  fuente: string;
  terminos: string[];
  exclusiones?: string[];
  /** Solo aplica si NO aparece ninguno de estos términos (p. ej. canela sin especificar). */
  siNoAparece?: string[];
  /** Solo si el término está en el nombre del producto (la harina vendida como harina, no la pasta). */
  soloEnTitulo?: boolean;
}

export const PRECAUCIONES: readonly Precaucion[] = [
  {
    id: 'miel-bebes',
    titulo: 'Miel y bebés',
    texto: 'No se debe dar miel a menores de 12 meses por riesgo de botulismo infantil.',
    nivel: 'importante',
    grupos: ['bebes'],
    fuente: 'AESAN / EFSA',
    terminos: ['miel'],
    exclusiones: ['miel de cana', 'miel de palma'],
  },
  {
    id: 'regaliz-glicirricina',
    titulo: 'Regaliz (glicirricina)',
    texto:
      'Tomado a menudo o en cantidad puede subir la tensión arterial y bajar el potasio. Evítalo si tienes hipertensión, problemas de corazón o de riñón, estás embarazada o tomas diuréticos, corticoides o digoxina.',
    nivel: 'importante',
    grupos: ['hipertension', 'embarazo', 'medicacion'],
    fuente: 'SCF/EFSA (referencia: ≤100 mg de ácido glicirrícico al día); EMA',
    terminos: ['regaliz', 'glycyrrhiza', 'orozuz'],
  },
  {
    id: 'canela-cassia-cumarina',
    titulo: 'Canela cassia (cumarina)',
    texto:
      'La canela cassia tiene mucha cumarina: en uso diario y en cantidad puede superar la ingesta tolerable y afectar al hígado, sobre todo en niños. Para uso diario es mejor la canela de Ceilán, que apenas tiene.',
    nivel: 'importante',
    grupos: ['ninos', 'higado', 'general'],
    fuente: 'EFSA (ingesta diaria tolerable de cumarina: 0,1 mg por kg de peso)',
    terminos: ['canela cassia', 'cassia', 'cinnamomum cassia', 'cinnamomum aromaticum', 'canela china'],
    exclusiones: ['cassia angustifolia', 'cassia senna', 'cassia acutifolia'],
  },
  {
    id: 'canela-sin-especificar',
    titulo: 'Canela sin especificar',
    texto:
      'Si no se indica el tipo, suele ser canela cassia, rica en cumarina: con moderación si es de uso diario. La de Ceilán apenas tiene.',
    nivel: 'info',
    grupos: ['ninos', 'higado'],
    fuente: 'EFSA',
    terminos: ['canela', 'cinnamomum'],
    siNoAparece: ['ceilan', 'ceylan', 'verum', 'zeylanicum', 'cassia'],
  },
  {
    id: 'nuez-moscada',
    titulo: 'Nuez moscada',
    texto:
      'En cantidades de cocina (una pizca) es segura. A partir de unos 5 g puede ser tóxica por la miristicina (náuseas, taquicardia, alucinaciones). Guárdala lejos de los niños.',
    nivel: 'info',
    grupos: ['ninos', 'general'],
    fuente: 'Toxicología clínica (miristicina)',
    terminos: ['nuez moscada', 'myristica'],
  },
  {
    id: 'algas-yodo',
    titulo: 'Algas pardas y yodo',
    texto:
      'Las algas pardas, sobre todo kombu, tienen muchísimo yodo: unos pocos gramos pueden superar el máximo diario tolerable (600 µg en adultos). Úsalas con moderación (por ejemplo, para el caldo, retirando la tira) y consulta si tienes problemas de tiroides, estás embarazada o es para niños.',
    nivel: 'importante',
    grupos: ['tiroides', 'embarazo', 'ninos'],
    fuente: 'EFSA (nivel máximo tolerable de yodo); AESAN',
    terminos: ['kombu', 'kelp', 'laminaria', 'fucus', 'arame', 'wakame', 'alga parda'],
  },
  {
    id: 'hijiki-arsenico',
    titulo: 'Hijiki (arsénico)',
    texto:
      'El alga hijiki acumula mucho arsénico inorgánico. Agencias de seguridad alimentaria como la FSA británica desaconsejan consumirla.',
    nivel: 'importante',
    grupos: ['general'],
    fuente: 'FSA (Reino Unido); AESAN',
    terminos: ['hijiki', 'hiziki'],
  },
  {
    id: 'hiperico-interacciones',
    titulo: 'Hipérico (hierba de San Juan)',
    texto:
      'Interacciona con muchos medicamentos y puede anular su efecto: anticonceptivos, antidepresivos, anticoagulantes, inmunosupresores, antirretrovirales y algunos fármacos del corazón. Si tomas cualquier medicación, consulta antes.',
    nivel: 'importante',
    grupos: ['medicacion', 'embarazo'],
    fuente: 'EMA (monografía HMPC de Hypericum perforatum)',
    terminos: ['hiperico', 'hierba de san juan', 'hypericum'],
  },
  {
    id: 'ginkgo-sangrado',
    titulo: 'Ginkgo',
    texto:
      'Puede aumentar el riesgo de sangrado si tomas anticoagulantes o antiagregantes (como la aspirina), y conviene dejarlo antes de una operación. Consulta si tomas medicación.',
    nivel: 'importante',
    grupos: ['medicacion'],
    fuente: 'EMA (monografía HMPC de Ginkgo biloba)',
    terminos: ['ginkgo'],
  },
  {
    id: 'sen-laxante',
    titulo: 'Sen (laxante estimulante)',
    texto:
      'Es un laxante estimulante: solo para estreñimiento puntual y no más de una semana sin consejo médico. No en embarazo, lactancia, menores de 12 años ni con enfermedad intestinal.',
    nivel: 'importante',
    grupos: ['embarazo', 'lactancia', 'ninos', 'general'],
    fuente: 'EMA (monografía HMPC de Senna)',
    terminos: ['sen', 'senna', 'cassia angustifolia', 'cassia acutifolia'],
  },
  {
    id: 'cafeina',
    titulo: 'Cafeína',
    texto:
      'Tiene cafeína. Referencia de la EFSA: hasta 400 mg al día en adultos sanos y 200 mg durante el embarazo o la lactancia; en niños y adolescentes, con moderación.',
    nivel: 'info',
    grupos: ['embarazo', 'lactancia', 'ninos'],
    fuente: 'EFSA (opinión científica sobre la seguridad de la cafeína, 2015)',
    terminos: [
      'cafe', 'cafeina', 'te verde', 'te negro', 'te rojo', 'te blanco', 'te oolong', 'te azul', 'matcha', 'sencha',
      'camellia sinensis', 'yerba mate', 'hierba mate', 'ilex paraguariensis', 'guarana', 'nuez de cola', 'pu erh',
      'te chai', 'gyokuro', 'bancha', 'genmaicha', 'kukicha',
    ],
    exclusiones: ['cafe de cebada', 'cafe de achicoria', 'cafe descafeinado', 'te rooibos'],
  },
  {
    id: 'linaza-cruda',
    titulo: 'Linaza cruda',
    texto:
      'La linaza cruda contiene glucósidos cianogénicos: con moderación. Como referencia prudente, no más de unos 15 g (1-2 cucharadas) por toma y acompañada de líquido.',
    nivel: 'info',
    grupos: ['general', 'ninos'],
    fuente: 'BfR (Alemania); EFSA (glucósidos cianogénicos)',
    terminos: ['lino', 'linaza', 'linum'],
  },
  {
    id: 'alubias-lectinas',
    titulo: 'Alubias crudas (lectinas)',
    texto:
      'Nunca crudas ni poco hechas: tienen lectinas (fitohemaglutinina) que solo se destruyen remojándolas y hirviéndolas bien, al menos 10 minutos a hervor fuerte. Ojo con las ollas de cocción lenta que no llegan a hervir.',
    nivel: 'importante',
    grupos: ['general'],
    fuente: 'FSA (Reino Unido); FDA (Bad Bug Book)',
    terminos: ['alubia', 'frijol', 'faba', 'judion', 'judia blanca', 'judia pinta', 'judia roja', 'judia negra', 'phaseolus'],
    exclusiones: ['judia verde', 'judia mungo', 'judia adzuki'],
  },
  {
    id: 'arroz-arsenico',
    titulo: 'Arroz (arsénico inorgánico)',
    texto:
      'El arroz acumula algo de arsénico inorgánico. Lavarlo y cocerlo en agua abundante, escurriéndolo, lo reduce bastante. En bebés y niños pequeños, no abuses de tortitas ni bebidas de arroz.',
    nivel: 'info',
    grupos: ['bebes', 'ninos'],
    fuente: 'AESAN; EFSA',
    terminos: ['arroz'],
    exclusiones: ['arroz konjac', 'arroz de konjac', 'vinagre de arroz', 'arroz de coliflor'],
  },
  {
    id: 'espirulina-b12',
    titulo: 'Espirulina y vitamina B12',
    texto:
      'La B12 de la espirulina es casi toda una forma inactiva (pseudovitamina B12): no sirve como fuente de B12 para veganos. Para eso, suplemento o alimentos enriquecidos.',
    nivel: 'importante',
    grupos: ['general'],
    fuente: 'EFSA; literatura científica sobre pseudovitamina B12 en cianobacterias',
    terminos: ['espirulina', 'spirulina', 'arthrospira'],
  },
  {
    id: 'fenogreco',
    titulo: 'Fenogreco',
    texto:
      'Puede bajar la glucosa (precaución si tomas antidiabéticos) y no conviene en dosis altas durante el embarazo. Es una legumbre: si tienes alergia al cacahuete o al garbanzo, puede darte reacción cruzada.',
    nivel: 'importante',
    grupos: ['diabetes', 'embarazo', 'alergia', 'medicacion'],
    fuente: 'EMA (monografía HMPC de Trigonella foenum-graecum)',
    terminos: ['fenogreco', 'alholva', 'trigonella'],
  },
  {
    id: 'curcuma-suplementos',
    titulo: 'Cúrcuma en dosis altas',
    texto:
      'En la cocina no hay problema. Los suplementos concentrados de cúrcuma pueden interaccionar con anticoagulantes y se han asociado a casos raros de daño hepático: consulta si los tomas.',
    nivel: 'info',
    grupos: ['medicacion', 'higado'],
    fuente: 'EMA; alertas de fitovigilancia (Italia, 2019)',
    terminos: ['curcuma', 'curcuma longa'],
  },
  {
    id: 'ajenjo-tuyona',
    titulo: 'Ajenjo (tuyona)',
    texto:
      'Uso puntual y en poca cantidad. No en embarazo, lactancia, niños, epilepsia ni problemas de hígado o vías biliares.',
    nivel: 'importante',
    grupos: ['embarazo', 'lactancia', 'ninos', 'higado'],
    fuente: 'EMA (monografía HMPC de Artemisia absinthium)',
    terminos: ['ajenjo', 'artemisia absinthium'],
  },
  {
    id: 'albaricoque-amargo',
    titulo: 'Semillas de albaricoque amargo',
    texto:
      'Contienen amigdalina, que libera cianuro. La EFSA aconseja no pasar de 3 semillas pequeñas al día en adultos (menos de media en niños pequeños); lo prudente es no tomarlas.',
    nivel: 'importante',
    grupos: ['general', 'ninos'],
    fuente: 'EFSA (2016)',
    terminos: ['albaricoque amargo', 'hueso de albaricoque', 'semilla de albaricoque', 'almendra de albaricoque'],
  },
  {
    id: 'valeriana',
    titulo: 'Valeriana',
    texto:
      'Puede dar somnolencia: no la mezcles con alcohol, sedantes ni ansiolíticos sin consultar, y no conduzcas si te da sueño. No en menores de 12 años ni en el embarazo sin consejo profesional.',
    nivel: 'importante',
    grupos: ['medicacion', 'ninos', 'embarazo'],
    fuente: 'EMA (monografía HMPC de Valeriana officinalis)',
    terminos: ['valeriana', 'valeriana officinalis'],
  },
  {
    id: 'anis-estrellado-bebes',
    titulo: 'Anís estrellado y bebés',
    texto:
      'No des infusión de anís estrellado a bebés ni a niños pequeños: ha habido intoxicaciones, también por confusión con el anís estrellado japonés, que es tóxico.',
    nivel: 'importante',
    grupos: ['bebes', 'ninos'],
    fuente: 'AESAN (alerta sanitaria, 2001)',
    terminos: ['anis estrellado', 'badiana', 'illicium'],
  },
  {
    id: 'hinojo-ninos',
    titulo: 'Infusión de hinojo',
    texto: 'No se recomienda en menores de 4 años ni de forma prolongada en el embarazo o la lactancia (estragol).',
    nivel: 'info',
    grupos: ['ninos', 'embarazo', 'lactancia'],
    fuente: 'EMA (monografía HMPC de Foeniculum vulgare)',
    terminos: ['hinojo', 'foeniculum'],
  },
  {
    id: 'poleo',
    titulo: 'Poleo',
    texto:
      'En infusión ocasional es habitual. Evita tomas altas o diarias en el embarazo y en niños pequeños, y nunca el aceite esencial de poleo, que es tóxico.',
    nivel: 'info',
    grupos: ['embarazo', 'ninos'],
    fuente: 'EMA (declaración pública sobre Mentha pulegium)',
    terminos: ['poleo', 'mentha pulegium'],
  },
  {
    id: 'asteraceas',
    titulo: 'Alergia a asteráceas',
    texto: 'Si tienes alergia a plantas de la familia de las compuestas (ambrosía, artemisa, margarita), puede darte reacción.',
    nivel: 'info',
    grupos: ['alergia'],
    fuente: 'EMA',
    terminos: ['manzanilla', 'camomila', 'matricaria', 'equinacea', 'calendula', 'arnica', 'artemisa'],
  },
  {
    id: 'ashwagandha',
    titulo: 'Ashwagandha',
    texto:
      'No en embarazo ni lactancia. Precaución si tienes problemas de tiroides o de hígado, o si tomas sedantes o inmunosupresores: consulta antes.',
    nivel: 'importante',
    grupos: ['embarazo', 'lactancia', 'tiroides', 'higado', 'medicacion'],
    fuente: 'Evaluación de riesgo de la DTU (Dinamarca, 2020)',
    terminos: ['ashwagandha', 'withania'],
  },
  {
    id: 'konjac-agua',
    titulo: 'Konjac (glucomanano)',
    texto: 'Tómalo con abundante agua: el glucomanano se hincha mucho y, seco, puede atragantar.',
    nivel: 'info',
    grupos: ['general', 'ninos'],
    fuente: 'EFSA',
    terminos: ['konjac', 'glucomanano'],
  },
  {
    id: 'chia-liquido',
    titulo: 'Semillas de chía',
    texto: 'Mejor hidratadas o con líquido: secas y a cucharadas pueden hincharse al tragarlas.',
    nivel: 'info',
    grupos: ['general'],
    fuente: 'Casos clínicos publicados',
    terminos: ['chia'],
  },
  {
    id: 'germinados-crudos',
    titulo: 'Germinados crudos',
    texto: 'Embarazadas, niños pequeños, mayores y personas inmunodeprimidas: mejor cocinados (riesgo de E. coli y salmonela).',
    nivel: 'info',
    grupos: ['embarazo', 'ninos', 'inmunodeprimidos'],
    fuente: 'EFSA; AESAN',
    terminos: ['germinado', 'brote'],
  },
  {
    id: 'harina-cruda',
    titulo: 'Harina y masa cruda',
    texto: 'No comas masa ni harina cruda: puede llevar bacterias como E. coli. Hornéala o cuécela.',
    nivel: 'info',
    grupos: ['ninos', 'general'],
    fuente: 'FDA; FSA',
    terminos: ['harina'],
    soloEnTitulo: true,
  },
  {
    id: 'yuca-cruda',
    titulo: 'Yuca (mandioca)',
    texto: 'Nunca cruda: pélala y cuécela bien, porque tiene glucósidos cianogénicos.',
    nivel: 'importante',
    grupos: ['general'],
    fuente: 'EFSA; FAO',
    terminos: ['yuca', 'mandioca', 'casava'],
    exclusiones: ['harina de yuca', 'tapioca', 'almidon de yuca'],
  },
];
