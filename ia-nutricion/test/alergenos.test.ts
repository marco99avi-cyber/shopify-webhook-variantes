import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AlergenoId } from '../src/conocimiento/alergenos.ts';
import { detectarAlergenos } from '../src/deteccion.ts';
import { normalizar, sanear, singular, tieneCaracteresSospechosos, tokenizar } from '../src/texto.ts';

const estado = (texto: string, id: AlergenoId) => detectarAlergenos(texto).alergenos[id].estado;

describe('texto', () => {
  it('singulariza los plurales que usamos', () => {
    assert.equal(singular('nueces'), 'nuez');
    assert.equal(singular('altramuces'), 'altramuz');
    assert.equal(singular('mejillones'), 'mejillon');
    assert.equal(singular('azucares'), 'azucar');
    assert.equal(singular('cacahuetes'), 'cacahuete');
    assert.equal(singular('carnes'), 'carne');
    assert.equal(singular('cereales'), 'cereal');
  });

  it('unifica los números E', () => {
    assert.equal(normalizar('E-220, E 476 y e322'), 'e220, e476 y e322');
  });

  it('quita caracteres invisibles y homoglifos antes de analizar', () => {
    const conInvisible = 'tri\u200Bgo';
    const conCirilica = 's\u043Eja';
    assert.equal(sanear(conInvisible), 'trigo');
    assert.equal(sanear(conCirilica), 'soja');
    assert.ok(tieneCaracteresSospechosos(conInvisible));
    assert.ok(tieneCaracteresSospechosos(conCirilica));
    assert.ok(!tieneCaracteresSospechosos('Harina de trigo'));
    assert.deepEqual(tokenizar('Harina de tri\u200Bgo'), ['harina', 'de', 'trigo']);
  });
});

describe('detección de alérgenos: estados', () => {
  it('«contiene» explícito y mención en ingredientes', () => {
    assert.equal(estado('Contiene gluten (avena).', 'gluten'), 'contiene');
    assert.equal(estado('Harina de trigo, agua, sal.', 'gluten'), 'contiene');
    assert.equal(estado('emulgentes (lecitina de soja, E-476)', 'soja'), 'contiene');
  });

  it('«puede contener» y trazas', () => {
    assert.equal(estado('Contiene cacahuetes y puede contener leche y soja.', 'leche'), 'puede_contener');
    assert.equal(estado('Contiene cacahuetes y puede contener leche y soja.', 'cacahuete'), 'contiene');
    assert.equal(estado('Puede contener trazas de leche y contiene soja.', 'soja'), 'contiene');
    assert.equal(estado('Elaborado en una fábrica que también procesa sésamo.', 'sesamo'), 'puede_contener');
  });

  it('negaciones', () => {
    assert.equal(estado('No contiene alérgenos de declaración obligatoria ni cereales con gluten entre sus ingredientes.', 'gluten'), 'negado');
    assert.equal(estado('Pan sin gluten.', 'gluten'), 'negado');
    assert.equal(estado('La «soja roja» es judía adzuki, no soja (Glycine max).', 'soja'), 'negado');
    assert.equal(estado('la nuez moscada no es un fruto de cáscara', 'frutos_cascara'), 'negado');
  });

  it('la negación corta no se come el resto de la frase', () => {
    assert.equal(estado('Sin azúcares añadidos, con harina de trigo.', 'gluten'), 'contiene');
  });

  it('«sin lactosa» no es «sin leche»', () => {
    const r = detectarAlergenos('Leche sin lactosa, cacao.');
    assert.equal(r.alergenos.leche.estado, 'contiene');
  });

  it('trazas genéricas y datos pendientes', () => {
    const r = detectarAlergenos('No contiene alérgenos; puede contener trazas (envasado en almacén compartido).');
    assert.ok(r.trazasGenericas);
    assert.ok(detectarAlergenos('Alérgenos pendientes de confirmar con el proveedor.').pendiente);
  });
});

describe('detección de alérgenos: falsos amigos y exenciones', () => {
  const casos: Array<[string, AlergenoId, string]> = [
    ['Harina de trigo sarraceno (100%).', 'gluten', 'no_detectado'],
    ['Harina de trigo sarraceno y sémola de trigo duro.', 'gluten', 'contiene'],
    ['Leche de coco en polvo, azúcar.', 'leche', 'no_detectado'],
    ['Manteca de cacao, pasta de cacao.', 'leche', 'no_detectado'],
    ['Mantequilla de cacahuete.', 'leche', 'no_detectado'],
    ['Mantequilla de cacahuete.', 'cacahuete', 'contiene'],
    ['Nuez moscada molida.', 'frutos_cascara', 'no_detectado'],
    ['Soja roja (judía adzuki) 100%.', 'soja', 'no_detectado'],
    ['Soja verde ecológica (judía mungo).', 'soja', 'no_detectado'],
    ['Leche de almendra.', 'frutos_cascara', 'contiene'],
    ['Leche de almendra.', 'leche', 'no_detectado'],
    ['Bebida de avena (leche de avena).', 'gluten', 'contiene'],
    ['Ácido láctico (E-270), fermentos lácticos.', 'leche', 'no_detectado'],
    ['Tahini (pasta de sésamo).', 'sesamo', 'contiene'],
    ['Albaricoque, conservante (E-220).', 'sulfitos', 'contiene'],
    ['Altramuces cocidos.', 'altramuces', 'contiene'],
    ['Mejillones en escabeche.', 'moluscos', 'contiene'],
    ['Cous cous de maíz.', 'gluten', 'no_detectado'],
    ['Cuscús.', 'gluten', 'contiene'],
    ['Harina de espelta integral.', 'gluten', 'contiene'],
    ['Tritordeum.', 'gluten', 'contiene'],
  ];
  for (const [texto, id, esperado] of casos) {
    it(`«${texto}» → ${id}: ${esperado}`, () => assert.equal(estado(texto, id), esperado));
  }

  it('derivados exentos del Anexo II', () => {
    assert.equal(estado('Jarabe de glucosa de trigo, cacao.', 'gluten'), 'exento');
    assert.equal(estado('Aceite de soja refinado.', 'soja'), 'exento');
  });

  it('lecitina sin origen → puede contener soja, con nota', () => {
    const r = detectarAlergenos('Cobertura (azúcar, pasta de cacao, emulgente: lecitina).');
    assert.equal(r.alergenos.soja.estado, 'puede_contener');
    assert.match(r.alergenos.soja.nota ?? '', /girasol/);
    assert.equal(detectarAlergenos('emulgente: lecitina de girasol').alergenos.soja.estado, 'no_detectado');
    assert.equal(detectarAlergenos('emulgentes: lecitinas (soja)').alergenos.soja.estado, 'contiene');
  });

  it('avena con «sin gluten» declarado', () => {
    const r = detectarAlergenos('Copos de avena sin gluten.');
    assert.equal(r.alergenos.gluten.sinGlutenDeclarado, true);
    const t = detectarAlergenos('Copos de avena sin gluten. Puede contener trazas de gluten.');
    assert.equal(t.alergenos.gluten.sinGlutenDeclarado, false);
  });

  it('no se deja engañar por caracteres invisibles ni homoglifos', () => {
    assert.equal(estado('Harina de tri\u200Bgo', 'gluten'), 'contiene');
    assert.equal(estado('Lecitina de s\u043Eja', 'soja'), 'contiene');
    assert.equal(estado('\uFF34\uFF32\uFF29\uFF27\uFF2F', 'gluten'), 'contiene');
  });
});
