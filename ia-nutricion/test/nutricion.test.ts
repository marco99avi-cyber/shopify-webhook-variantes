import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { declaracionesNutricionales, declaracionesSalud, escalar, kcalCalculadas, leerNumero, leerNutricion, niveles } from '../src/nutricion.ts';

describe('lectura de números', () => {
  it('decimales con coma y punto, miles en energía', () => {
    assert.equal(leerNumero('0,02'), 0.02);
    assert.equal(leerNumero('16.0'), 16);
    assert.equal(leerNumero('1.420', true), 1420);
    assert.equal(leerNumero('1.5'), 1.5);
  });
});

describe('tabla nutricional', () => {
  it('formato multilínea con paréntesis', () => {
    const n = leerNutricion(
      'Valores medios orientativos por 100 g:\nEnergía 2322 kJ / 555 kcal\nGrasas 38 g (de las cuales saturadas 13 g)\nHidratos de carbono 36 g (de los cuales azúcares 30 g)\nProteínas 11 g\nSal 0,02 g\nFibra 6 g',
    );
    assert.ok(n);
    assert.equal(n.kcal, 555);
    assert.equal(n.kj, 2322);
    assert.equal(n.grasas, 38);
    assert.equal(n.saturadas, 13);
    assert.equal(n.hidratos, 36);
    assert.equal(n.azucares, 30);
    assert.equal(n.proteinas, 11);
    assert.equal(n.sal, 0.02);
    assert.equal(n.fibra, 6);
    assert.equal(n.base, 'producto');
  });

  it('formato en línea con kcal primero y miles con punto', () => {
    const n = leerNutricion('Por 100 g de producto crudo: Energía 1.420 kJ / 335 kcal; Grasas 1,5 g, de las cuales saturadas 0,3 g; Hidratos de carbono 60 g, de los cuales azúcares 2,5 g; Fibra alimentaria 17 g; Proteínas 21 g; Sal 0,02 g.');
    assert.ok(n);
    assert.equal(n.kj, 1420);
    assert.equal(n.kcal, 335);
    assert.equal(n.fibra, 17);
    assert.equal(n.base, 'producto_crudo');
  });

  it('dos puntos tras la etiqueta', () => {
    const n = leerNutricion('Energía: 350 kcal / 1480 kJ\nGrasas: 5 g, de las cuales saturadas 0,8 g\nHidratos de carbono: 38 g, de los cuales azúcares 5 g\nProteínas: 48 g\nSal: 0,1 g');
    assert.ok(n);
    assert.equal(n.kcal, 350);
    assert.equal(n.proteinas, 48);
  });

  it('infusión preparada → base líquida', () => {
    const n = leerNutricion('Por 100 ml de infusión preparada sin azúcar: Energía 4 kJ/1 kcal; Grasas 0 g, de las cuales saturadas 0 g; Hidratos de carbono 0,2 g, de los cuales azúcares 0 g; Proteínas 0 g; Sal 0 g.');
    assert.ok(n);
    assert.equal(n.base, 'bebida_preparada');
    assert.equal(n.kcal, 1);
  });

  it('micronutrientes con %VRN declarado o calculado', () => {
    const n = leerNutricion('Energía 1215 kJ / 290 kcal\nGrasas 7 g\nHidratos de carbono 24 g\nProteínas 57 g\nHierro 28 mg (200% VRN)\nVitamina B12 25 µg');
    assert.ok(n);
    const hierro = n.micronutrientes.find((m) => m.clave === 'hierro');
    assert.equal(hierro?.vrnPct, 200);
    const b12 = n.micronutrientes.find((m) => m.clave === 'vitamina-b12');
    assert.equal(b12?.vrnPct, 1000);
  });

  it('texto sin tabla → null', () => {
    assert.equal(leerNutricion('Producto natural, sin aditivos.'), null);
    assert.equal(leerNutricion(null), null);
  });
});

describe('declaraciones (Reg. 1924/2006)', () => {
  const base = { base: 'producto' as const, baseTexto: '100 g', kj: null, micronutrientes: [], estimada: false, notaBase: null };

  it('umbrales de fibra, proteína, azúcar y sal', () => {
    const d = declaracionesNutricionales({ ...base, kcal: 372, grasas: 7, saturadas: 1.3, hidratos: 60, azucares: 1.1, fibra: 10, proteinas: 13, sal: 0 });
    assert.ok(d.includes('alto contenido de fibra'));
    assert.ok(d.includes('fuente de proteínas'));
    assert.ok(d.includes('bajo contenido de azúcares'));
    assert.ok(d.includes('sin sal'));
    assert.ok(!d.includes('bajo contenido de grasa'));
  });

  it('alto en proteínas a partir del 20 % de la energía', () => {
    const d = declaracionesNutricionales({ ...base, kcal: 290, grasas: 7, saturadas: 2, hidratos: 24, azucares: 3, fibra: 4, proteinas: 57, sal: 1 });
    assert.ok(d.includes('alto contenido de proteínas'));
  });

  it('bajo en grasas saturadas exige ≤ 10 % de la energía', () => {
    const d = declaracionesNutricionales({ ...base, kcal: 20, grasas: 1.5, saturadas: 1.4, hidratos: 2, azucares: 1, fibra: 0, proteinas: 1, sal: 0.1 });
    assert.ok(!d.includes('bajo contenido de grasas saturadas'));
  });

  it('declaraciones de salud solo para nutrientes que son «fuente»', () => {
    const s = declaracionesSalud({ ...base, kcal: 290, grasas: 7, saturadas: 2, hidratos: 24, azucares: 3, fibra: 4, proteinas: 57, sal: 1, micronutrientes: [{ clave: 'hierro', nombre: 'hierro', cantidad: 28, unidad: 'mg', vrnPct: 200 }] });
    assert.ok(s);
    assert.ok(s.frases.some((f) => f.startsWith('El hierro')));
    assert.match(s.mencion, /dieta variada/);
  });

  it('semáforo y energía calculada', () => {
    const n = { ...base, kcal: 555, grasas: 38, saturadas: 13, hidratos: 36, azucares: 30, fibra: 6, proteinas: 11, sal: 0.02 };
    assert.deepEqual(niveles(n), { grasas: 'alto', saturadas: 'alto', azucares: 'alto', sal: 'bajo' });
    assert.equal(kcalCalculadas(n), 542);
    assert.equal(escalar(n, 30).kcal, 167);
  });
});
