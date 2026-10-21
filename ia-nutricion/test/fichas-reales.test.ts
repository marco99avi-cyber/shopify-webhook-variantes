/**
 * Veredictos esperados sobre productos REALES del catálogo (test/fixtures/catalogo-muestra.json).
 * Si alguien toca el motor y cambia uno de estos, el test lo para.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { crearCatalogo } from '../src/catalogo.ts';
import { auditarCatalogo } from '../src/auditoria.ts';

const datos = JSON.parse(readFileSync(new URL('./fixtures/catalogo-muestra.json', import.meta.url), 'utf8'));
const cat = crearCatalogo(datos);
const f = (handle: string) => {
  const x = cat.porHandle(handle);
  assert.ok(x, `falta ${handle} en la muestra`);
  return x;
};

describe('gluten en productos reales', () => {
  const casos: Array<[string, string]> = [
    ['copos-de-avena', 'contiene'],
    ['macarron-de-trigo-sarraceno-ecologico-a-granel-en-madrid', 'contiene'],
    ['espiral-de-trigo-sarraceno-ecologico-a-granel-en-madrid', 'sin_gluten_en_ingredientes'],
    ['espiral-de-espelta-ecologico-a-granel-en-madrid', 'contiene'],
    ['harina-de-tritordeum-a-granel-en-madrid', 'contiene'],
    ['levadura-de-cerveza-a-granel-en-madrid', 'contiene'],
    ['levadura-nutricional-a-granel-en-madrid', 'sin_gluten_en_ingredientes'],
    ['arroz-basmati-integral-a-granel-en-madrid', 'sin_gluten_en_ingredientes'],
    ['aroma-de-carne-a-granel-en-madrid', 'puede_contener'],
    ['arroz-basmati-con-curcuma-y-jengibre-ecologico-a-granel-en-madrid', 'sin_confirmar'],
    ['proteina-con-creatina-cacao-y-vitaminas-a-granel', 'sin_datos'],
    ['muesli-crujiente-con-chocolate-ecologico-a-granel-en-madrid', 'contiene'],
  ];
  for (const [handle, esperado] of casos) {
    it(`${handle} → ${esperado}`, () => assert.equal(f(handle).gluten.veredicto, esperado));
  }

  it('ningún producto de la tienda sale «apto para celíacos»', () => {
    for (const x of cat.fichas) assert.equal(x.gluten.aptoCeliacos, false, x.titulo);
  });

  it('el resumen sin gluten avisa siempre del granel', () => {
    for (const x of cat.fichas.filter((y) => y.gluten.veredicto === 'sin_gluten_en_ingredientes')) {
      assert.match(x.gluten.resumen, /granel/, x.titulo);
      assert.match(x.gluten.resumen, /celíac/, x.titulo);
    }
  });

  it('la avena explica la certificación', () => {
    assert.match(f('copos-de-avena').gluten.resumen, /certificada/);
  });
});

describe('alérgenos en productos reales', () => {
  it('almendra bañada: soja y frutos de cáscara, puede leche', () => {
    const x = f('almendras-chocolate-negro-a-granel');
    const ids = Object.fromEntries(x.alergenos.map((a) => [a.id, a.estado]));
    assert.deepEqual(ids, { soja: 'contiene', leche: 'puede_contener', frutos_cascara: 'contiene' });
  });
  it('soja roja no es soja; soja amarilla sí', () => {
    assert.equal(f('soja-roja-ecologica-a-granel-en-madrid').alergenos.length, 0);
    assert.equal(f('soja-amarilla-soja-blanca-a-granel-en-madrid').alergenos[0]?.id, 'soja');
  });
  it('matcha latte: la leche de coco no es leche', () => {
    assert.equal(f('matcha-latte-eco-a-granel').alergenos.length, 0);
  });
  it('albaricoque: los sulfitos de los ingredientes cuentan aunque la ficha diga lo contrario', () => {
    const x = f('albaricoque-deshidratado-sin-azucar-a-granel-en-madrid');
    assert.equal(x.alergenos.find((a) => a.id === 'sulfitos')?.estado, 'puede_contener');
  });
  it('cacahuete con chocolate: lecitina sin origen → puede soja', () => {
    const x = f('cacahuetes-con-chocolate-a-granel-en-madrid');
    assert.equal(x.alergenos.find((a) => a.id === 'soja')?.estado, 'puede_contener');
    assert.equal(x.alergenos.find((a) => a.id === 'cacahuete')?.estado, 'contiene');
  });
  it('nuez moscada no es fruto de cáscara', () => {
    assert.equal(f('nuez-moscada-molida').alergenos.length, 0);
  });
  it('datos pendientes → puede contener todo lo que dice', () => {
    const x = f('aroma-de-carne-a-granel-en-madrid');
    assert.deepEqual(x.alergenos.map((a) => a.id).sort(), ['apio', 'gluten', 'leche', 'mostaza', 'soja']);
    assert.ok(x.alergenos.every((a) => a.estado === 'puede_contener'));
    assert.match(x.alergenosResumen, /pendiente/);
  });
});

describe('azúcar en productos reales', () => {
  it('matcha latte lleva azúcar añadido', () => {
    const x = f('matcha-latte-eco-a-granel');
    assert.equal(x.azucar.anadido, 'si');
    assert.deepEqual(x.azucar.fuentes, ['azúcar']);
  });
  it('miel: es en sí un azúcar', () => assert.equal(f('miel-cruda-de-lavanda-cultivada-a-granel').azucar.anadido, 'no_aplica'));
  it('cacahuete frito con miel sí lleva azúcar añadido', () => {
    const x = f('cacahuete-frito-con-miel-a-granel-en-madrid');
    assert.equal(x.azucar.anadido, 'si');
    assert.deepEqual([...x.azucar.fuentes].sort(), ['azúcar', 'miel']);
  });
  it('albaricoque: azúcares propios, sin añadido', () => {
    const x = f('albaricoque-deshidratado-sin-azucar-a-granel-en-madrid');
    assert.equal(x.azucar.anadido, 'no');
    assert.match(x.azucar.resumen, /propios/);
  });
  it('muesli «sin azúcares añadidos» con chocolate → incoherencia', () => {
    const x = f('muesli-crujiente-con-chocolate-ecologico-a-granel-en-madrid');
    assert.equal(x.azucar.anadido, 'posible');
    assert.ok(x.azucar.incoherencia);
  });
  it('arándanos «sin azúcar añadido» con 65 g → se avisa', () => {
    const x = f('arandanos-deshidratados-a-granel');
    assert.ok(x.azucar.incoherencia);
    assert.match(x.azucar.resumen, /verificando/);
  });
  it('aloe vera «puede contener azúcar añadido» → posible', () => assert.equal(f('aloe-vera-deshidratado-a-granel-en-madrid').azucar.anadido, 'posible'));
  it('aroma de carne pendiente → desconocido', () => assert.equal(f('aroma-de-carne-a-granel-en-madrid').azucar.anadido, 'desconocido'));
});

describe('vegano, precauciones y nutrición en productos reales', () => {
  it('goma laca (E-904) → no vegano', () => {
    assert.equal(f('almendras-chocolate-negro-a-granel').vegano.estado, 'no');
    assert.match(f('almendras-chocolate-negro-a-granel').vegano.motivo ?? '', /E-904/);
  });
  it('miel → no vegano', () => assert.equal(f('miel-cruda-de-lavanda-cultivada-a-granel').vegano.estado, 'no'));
  it('«aroma de carne» no es carne, pero está pendiente', () => assert.equal(f('aroma-de-carne-a-granel-en-madrid').vegano.estado, 'desconocido'));

  const precauciones: Array<[string, string]> = [
    ['miel-cruda-de-lavanda-cultivada-a-granel', 'miel-bebes'],
    ['regaliz-triturado-a-granel-en-madrid', 'regaliz-glicirricina'],
    ['canela-cassia-a-granel-en-madrid', 'canela-cassia-cumarina'],
    ['espirulina-a-granel', 'espirulina-b12'],
    ['hojas-de-sen-a-granel-en-madrid', 'sen-laxante'],
    ['ginkgo-biloba-a-granel-en-madrid', 'ginkgo-sangrado'],
    ['alubia-pinta-especial-a-granel-en-madrid', 'alubias-lectinas'],
    ['te-verde-sencha-a-granel-en-madrid', 'cafeina'],
    ['hierba-mate-a-granel-en-madrid', 'cafeina'],
    ['ajenjo-a-granel-en-madrid', 'ajenjo-tuyona'],
  ];
  for (const [handle, id] of precauciones) {
    it(`${handle} → precaución ${id}`, () => assert.ok(f(handle).precauciones.some((p) => p.id === id)));
  }
  it('la canela de Ceilán no avisa de cumarina; el sen no se confunde con canela cassia', () => {
    assert.equal(f('canela-ceylan-molida-a-granel-en-madrid').precauciones.length, 0);
    assert.ok(!f('hojas-de-sen-a-granel-en-madrid').precauciones.some((p) => p.id.startsWith('canela')));
  });
  it('la pasta hecha con harina no recibe el aviso de «harina cruda»', () => {
    assert.ok(!f('macarron-de-trigo-sarraceno-ecologico-a-granel-en-madrid').precauciones.some((p) => p.id === 'harina-cruda'));
  });

  it('espirulina: alto en proteínas, fuente de hierro, base sólida', () => {
    const x = f('espirulina-a-granel');
    assert.ok(x.declaraciones.includes('alto contenido de proteínas'));
    assert.ok(x.declaraciones.some((d) => d.includes('hierro')));
  });
  it('té: tabla por 100 ml de infusión', () => assert.equal(f('te-verde-sencha-a-granel-en-madrid').nutricion?.base, 'bebida_preparada'));
  it('copos de avena: ración de 40 g', () => assert.deepEqual(f('copos-de-avena').racion, { gramos: 40, unidad: 'ración' }));
});

describe('auditoría sobre la muestra real', () => {
  const h = auditarCatalogo(cat);
  const tiene = (handle: string, regla: string) => h.some((x) => x.handle === handle && x.regla === regla);
  it('detecta el sulfito no declarado del albaricoque', () => assert.ok(tiene('albaricoque-deshidratado-sin-azucar-a-granel-en-madrid', 'alergeno-no-declarado')));
  it('detecta el muesli «sin azúcares añadidos» con chocolate', () => assert.ok(tiene('muesli-crujiente-con-chocolate-ecologico-a-granel-en-madrid', 'sin-azucar-contradictorio')));
  it('detecta los arándanos sospechosos', () => assert.ok(tiene('arandanos-deshidratados-a-granel', 'azucar-sospechoso')));
  it('detecta tablas con la fibra dentro de los hidratos', () => assert.ok(tiene('lino-marron-a-granel-en-madrid', 'macros-imposibles')));
  it('detecta la ficha sin alérgenos', () => assert.ok(tiene('proteina-con-creatina-cacao-y-vitaminas-a-granel', 'falta-alergenos')));
  it('no da falsos positivos de alérgeno no declarado en fichas correctas', () => {
    for (const handle of ['almendras-chocolate-negro-a-granel', 'matcha-latte-eco-a-granel', 'soja-roja-ecologica-a-granel-en-madrid', 'cacahuetes-con-chocolate-a-granel-en-madrid']) {
      assert.ok(!tiene(handle, 'alergeno-no-declarado'), handle);
    }
  });
});
