import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBracket, compute, addWin, undoWin, validarInscripcion, posiblesDuplicados, emptyState, MECA} from '../motor.js';

const people = n => [...Array(n)].map((_, i) => ({id:'p' + i, name:'P' + i, club:''}));

test('cada llave termina con un campeón, un 2° que perdió la final y todos los demás eliminados con dos derrotas', () => {
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
      const [champ, second] = c.podium;
      assert.ok((losses[champ] || 0) <= 1);
      assert.equal(c.M.GF.w, champ);
      assert.equal(c.M.GF.l, second);
      assert.ok(!c.M.GF2, 'no hay final decisiva');
      for (const p of people(n)) if (p.id !== champ && p.id !== second) assert.ok((losses[p.id] || 0) >= 2, `${p.id} no fue eliminado (n=${n})`);
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
  const base = {name:'Ana Díaz', email:'ana@inacapmail.cl', career:'meca', year:'2°', section:'201', weight:'78,5', peso:true, ld:true};
  const ok = validarInscripcion(st, base);
  assert.deepEqual(ok.competitor.cats, ['m80d', 'ld']);
  assert.equal(ok.competitor.club, `${MECA} · 2° año · Sec. 201`);
  st.competitors.push(ok.competitor);
  assert.match(validarInscripcion(st, base).error, /ya está inscrito/);
  // Volver a llenar la ficha para "actualizar" no crea otra inscripción: mismo correo, o mismo nombre con otras tildes o espacios.
  assert.equal(validarInscripcion(st, {...base, name:'Ana María Díaz', year:'3°'}).yaInscrito, ok.competitor);
  assert.equal(validarInscripcion(st, {...base, name:'  ana   diaz ', email:'otro@mail.cl'}).yaInscrito, ok.competitor);
  assert.equal(posiblesDuplicados(st).size, 0);
  st.competitors.push({...ok.competitor, id:'copia', name:'Ana Diaz', email:'otro@mail.cl'});
  assert.deepEqual([...posiblesDuplicados(st)].sort(), ['copia', ok.competitor.id].sort());
  st.competitors.pop();
  st.competitors.push({...ok.competitor, id:'copia', name:'Ana Diaz Soto', email:'otro@mail.cl'});
  assert.equal(posiblesDuplicados(st).size, 2);
  st.competitors.pop();
  const otra = validarInscripcion(st, {name:'Luis Rojas', email:'luis@mail.cl', career:'otra', other:'Electricidad', weight:90, peso:true});
  assert.match(otra.error, /solo para Mecánica Automotriz y Mantenimiento Industrial/);
  // Mantenimiento Industrial también es del área de Mecánica: compite en las de peso, elegida en la lista o escrita a mano.
  const mant = validarInscripcion(st, {name:'Pía Lagos', email:'pia@mail.cl', career:'mant', year:'1°', weight:66, peso:true, li:true});
  assert.deepEqual([mant.competitor.career, mant.competitor.cats], ['Mantenimiento Industrial', ['m70d', 'li']]);
  const escrita = validarInscripcion(st, {name:'Tomás Vera', email:'tomas@mail.cl', career:'otra', other:'mantencion industrial', weight:95, peso:true});
  assert.deepEqual([escrita.competitor.career, escrita.competitor.cats], ['Mantenimiento Industrial', ['m100d']]);
  assert.match(validarInscripcion(st, {...base, name:'Sin Correo', email:'sin-arroba'}).error, /correo válido/);
  for (let i = 0; i < 7; i++) st.competitors.push({id:'x' + i, name:'X' + i, cats:['m80d']});
  assert.match(validarInscripcion(st, {...base, name:'Otro Más', email:'otro.mas@mail.cl', ld:false}).error, /8 cupos/);
});

test('pesaje: mueve a la categoría del peso real, o a la libre si no hay cupo', async () => {
  const {planPesaje, aplicarPesaje} = await import('../motor.js');
  const st = emptyState();
  const add = (id, weight, cats, career = MECA) => st.competitors.push({id, name:id, career, club:'', weight, cats, weighed:false});
  add('a', 64, ['m70d']);
  add('b', 68, ['m70d', 'ld']);
  add('c', 80, ['ld', 'li'], 'Construcción civil');
  for (let i = 0; i < 8; i++) add('x' + i, 85, ['m90d']);

  assert.deepEqual(planPesaje(st, st.competitors[0], 69.9).same, true);
  aplicarPesaje(st, 'a', 76.4, 'mover');
  const a = st.competitors.find(x => x.id === 'a');
  assert.deepEqual([a.cats, a.weight, a.declared, a.weighed], [['m80d'], 76.4, 64, true]);

  const pb = planPesaje(st, st.competitors.find(x => x.id === 'b'), 88);
  assert.equal(pb.to, 'm90d');
  assert.ok(pb.toErr && pb.inLd);
  aplicarPesaje(st, 'b', 88, 'fuera');
  assert.deepEqual(st.competitors.find(x => x.id === 'b').cats, ['ld']);

  add('d', 70, ['m70d']);
  aplicarPesaje(st, 'd', 89, 'libre');
  assert.deepEqual(st.competitors.find(x => x.id === 'd').cats, ['ld']);

  add('e', 70, ['m70d']);
  aplicarPesaje(st, 'e', 89, 'fuera');
  assert.equal(st.competitors.find(x => x.id === 'e'), undefined);

  assert.equal(planPesaje(st, st.competitors.find(x => x.id === 'c'), 95).same, true);

  add('f', 70, ['m70d']);
  st.brackets.m70d = {locked:true};
  assert.ok(planPesaje(st, st.competitors.find(x => x.id === 'f'), 79).locked);
  aplicarPesaje(st, 'f', 79, null);
  assert.deepEqual(st.competitors.find(x => x.id === 'f').cats, ['m70d']);
});

test('las inscripciones y cambios de alumnos cierran al terminar el 23 de noviembre (hora de Chile)', async () => {
  const {abierto} = await import('../motor.js');
  assert.equal(abierto(Date.parse('2026-11-23T23:59:00-03:00')), true);
  assert.equal(abierto(Date.parse('2026-11-24T00:00:00-03:00')), false);
  assert.equal(abierto(Date.parse('2026-11-24T14:00:00-03:00')), false);
});

test('si gana la final quien viene del repechaje, es campeón sin final decisiva', () => {
  const br = makeBracket(people(4));
  let c;
  while (!(c = compute(br)).podium){
    const m = c.live[0];
    addWin(br, m, m.id === 'GF' ? m.s[1] : m.s[0]);
  }
  assert.equal(c.podium[0], c.M.GF.s[1]);
  assert.equal(c.podium[1], c.M.GF.s[0]);
  // Un torneo guardado con la final decisiva antigua se limpia solo.
  br.results.GF2 = c.podium[0]; br.pulls.GF2 = [c.podium[0]];
  assert.equal(compute(br).podium[0], c.podium[0]);
  assert.ok(!br.results.GF2 && !br.pulls.GF2);
});
