import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBracket, compute, addWin, undoWin, validarInscripcion, emptyState, MECA} from '../motor.js';

const people = n => [...Array(n)].map((_, i) => ({id:'p' + i, name:'P' + i, club:''}));

test('cada llave termina con un campeón que perdió a lo más una vez y todos los demás eliminados con dos derrotas', () => {
  for (const n of [2, 3, 5, 8, 11, 16]){
    for (let t = 0; t < 40; t++){
      const br = makeBracket(people(n));
      let c, guard = 0;
      while (!(c = compute(br)).podium){
        assert.ok(guard++ < 300, 'la llave no avanza');
        const m = c.live[0];
        assert.ok(m, `llave de ${n} trabada`);
        addWin(br, m, m.s[Math.random() < 0.5 ? 0 : 1]);
        if (Math.random() < 0.1) undoWin(br, compute(br).M[m.id]);
      }
      const losses = {};
      for (const id of c.order){ const m = c.M[id]; if (m.done && !m.bye) losses[m.l] = (losses[m.l] || 0) + 1; }
      const champ = c.podium[0];
      assert.ok((losses[champ] || 0) <= 1);
      for (const p of people(n)) if (p.id !== champ) assert.ok((losses[p.id] || 0) >= 2, `${p.id} no fue eliminado (n=${n})`);
    }
  }
});

test('solo la final de 1° y 2° va al mejor de 3', () => {
  const br = makeBracket(people(4));
  let c;
  while (!(c = compute(br)).podium){
    const m = c.live[0];
    assert.equal(m.bo3, m.b === 'F');
    addWin(br, m, m.s[0]);
  }
  assert.equal(br.pulls.GF.length, 2);
});

test('la ficha aplica la regla de Mecánica, los cupos y los duplicados', () => {
  const st = emptyState();
  const base = {name:'Ana Díaz', career:'meca', year:'2°', section:'201', weight:'78,5', peso:true, ld:true};
  const ok = validarInscripcion(st, base);
  assert.deepEqual(ok.competitor.cats, ['m80d', 'ld']);
  assert.equal(ok.competitor.club, `${MECA} · 2° año · Sec. 201`);
  st.competitors.push(ok.competitor);
  assert.match(validarInscripcion(st, base).error, /ya está inscrito/);
  const otra = validarInscripcion(st, {name:'Luis Rojas', career:'otra', other:'Electricidad', weight:90, peso:true});
  assert.match(otra.error, /solo para Mecánica/);
  for (let i = 0; i < 7; i++) st.competitors.push({id:'x' + i, name:'X' + i, cats:['m80d']});
  assert.match(validarInscripcion(st, {...base, name:'Otro Más', ld:false}).error, /8 cupos/);
});
