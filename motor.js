// Reglas del campeonato y motor de doble eliminación.
// Lo usan las páginas (en el navegador) y las funciones de /api (en el servidor).

export const MECA = 'Mecánica Automotriz';
export const BYE = '__BYE__';
const WEIGHTS = [['m70', '-70 kg'], ['m80', '-80 kg'], ['m90', '-90 kg'], ['m100', '-100 kg'], ['p100', '+100 kg']];
const ARMS = {d:'derecho', i:'izquierdo'};
// Las categorías de peso se compiten solo con brazo derecho y son solo para Mecánica Automotriz.
// Las libres se compiten con derecho e izquierdo y están abiertas a todas las carreras.
export const CATS = [
  ...WEIGHTS.map(([w, l]) => ({id:w + 'd', label:l, short:l.replace(' kg', ''), weight:l, arm:'d', group:'peso', max:8})),
  ...Object.keys(ARMS).map(arm => ({id:'l' + arm, label:`Libre brazo ${ARMS[arm]}`, short:`Libre ${arm.toUpperCase()}`, weight:`Libre ${ARMS[arm]}`, arm, group:'libre', max:16})),
];
export const catById = id => CATS.find(c => c.id === id);
export const YEARS = ['1°', '2°', '3°', '4°'];

export function weightCat(w){
  if (w <= 70) return 'm70';
  if (w <= 80) return 'm80';
  if (w <= 90) return 'm90';
  if (w <= 100) return 'm100';
  return 'p100';
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const emptyState = () => ({competitors:[], brackets:{}});
export const members = (st, catId) => st.competitors.filter(c => c.cats.includes(catId));

// Descarta categorías que ya no existen y completa campos faltantes.
export function clean(st){
  if (!st || !Array.isArray(st.competitors)) return emptyState();
  st.brackets = st.brackets || {};
  for (const id of Object.keys(st.brackets)) if (!catById(id)) delete st.brackets[id];
  for (const c of st.competitors) c.cats = (c.cats || []).filter(id => catById(id));
  st.competitors = st.competitors.filter(c => c.cats.length);
  return st;
}

// Motivo por el que alguien no puede entrar a una categoría, o null si hay cupo.
export function cupoError(st, catId){
  const c = catById(catId);
  if (st.brackets[catId]) return `La inscripción de ${c.label} está cerrada porque su llave ya se sorteó.`;
  if (members(st, catId).length >= c.max) return `${c.label} ya tiene sus ${c.max} cupos ocupados.`;
  return null;
}

// Valida una ficha de inscripción. Devuelve {error} o {competitor} listo para agregar.
export function validarInscripcion(st, d){
  const txt = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const name = txt(d.name, 80);
  const isMeca = d.career === 'meca';
  const career = isMeca ? MECA : txt(d.other, 80);
  const year = YEARS.includes(d.year) ? d.year : '';
  const section = txt(d.section, 20);
  const weight = parseFloat(String(d.weight ?? '').replace(',', '.'));
  if (name.length < 3) return {error:'Escribe tu nombre completo.'};
  if (!career) return {error:'Escribe el nombre de tu carrera.'};
  if (!(weight >= 30 && weight <= 250)) return {error:'Escribe tu peso en kilos, por ejemplo 78.5.'};
  const cats = [];
  if (isMeca && d.peso) cats.push(weightCat(weight) + 'd');
  if (d.ld) cats.push('ld');
  if (d.li) cats.push('li');
  if (!cats.length) return {error:isMeca ? 'Elige al menos una categoría.' : `Elige al menos una categoría libre. Las de peso son solo para ${MECA}.`};
  if (st.competitors.some(c => c.name.toLowerCase() === name.toLowerCase())) return {error:`${name} ya está inscrito. Si hay un error, pide al organizador que lo corrija.`};
  for (const id of cats){ const e = cupoError(st, id); if (e) return {error:e}; }
  const club = `${career}${year ? ' · ' + year + ' año' : ''}${section ? ' · Sec. ' + section : ''}`;
  return {competitor:{id:uid(), name, career, club, weight:Math.round(weight * 10) / 10, cats, weighed:false, at:Date.now()}};
}

// Qué pasa con la categoría de peso de un competidor al registrar su peso real en la balanza.
// cur: categoría de peso actual (o undefined); to: la que corresponde al peso real.
// Si cambia: locked (la llave actual ya se sorteó), toErr (sin cupo en la nueva) y ldErr (sin cupo en libre derecho).
export function planPesaje(st, c, w){
  const cur = c.cats.find(id => catById(id).group === 'peso');
  if (!cur || !(w >= 30)) return {cur, to:cur, same:true};
  const to = weightCat(w) + 'd';
  if (to === cur) return {cur, to, same:true};
  const others = {...st, competitors:st.competitors.filter(x => x.id !== c.id)};
  return {
    cur, to, same:false,
    locked:st.brackets[cur] ? `La llave de ${catById(cur).label} ya se sorteó. Para moverlo, primero reinicia esa llave.` : null,
    toErr:cupoError(others, to),
    inLd:c.cats.includes('ld'),
    ldErr:c.cats.includes('ld') ? null : cupoError(others, 'ld'),
  };
}

// Registra el peso real. choice, cuando cambia la categoría: 'mover' (a la que corresponde), 'libre' (a libre derecho) o 'fuera' (sin categoría de peso;
// si no le queda ninguna categoría, sale de la lista).
export function aplicarPesaje(st, id, w, choice){
  const c = st.competitors.find(x => x.id === id);
  if (!c) return;
  const plan = planPesaje(st, c, w);
  if (c.declared === undefined) c.declared = c.weight;
  c.weight = Math.round(w * 10) / 10;
  c.weighed = true;
  if (plan.same || plan.locked || !choice) return;
  const cats = c.cats.filter(x => x !== plan.cur);
  if (choice === 'mover') cats.push(plan.to);
  if (choice === 'libre' && !cats.includes('ld')) cats.push('ld');
  if (!cats.length){ st.competitors = st.competitors.filter(x => x.id !== id); return; }
  c.cats = CATS.map(x => x.id).filter(x => cats.includes(x));
}

// Lo que ve cualquier persona: sin peso ni pesaje.
export function publicState(st){
  return {competitors:st.competitors.map(c => ({id:c.id, name:c.name, club:c.club, cats:c.cats})), brackets:st.brackets};
}

/* ---------- motor de doble eliminación ---------- */
function seedOrder(P){
  let a = [1];
  while (a.length < P){ const m = a.length * 2 + 1; a = a.flatMap(s => [s, m - s]); }
  return a;
}
function nextPow2(n){ let p = 4; while (p < n) p *= 2; return p; }

export function makeBracket(people, shuffle = Math.random){
  const list = people.map(p => ({id:p.id, name:p.name, club:p.club}));
  for (let i = list.length - 1; i > 0; i--){ const j = Math.floor(shuffle() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return {entrants:list, size:nextPow2(list.length), results:{}, pulls:{}};
}

// Reconstruye la llave desde cero y reaplica los resultados guardados.
// Un resultado que ya no calza con los luchadores del cruce (por una corrección) se descarta.
export function compute(br){
  const P = br.size, R = Math.log2(P), LR = 2 * (R - 1);
  const M = {}, order = [];
  const add = (id, b, r, i, key) => { M[id] = {id, b, r, i, key, s:[null, null], w:null, l:null, done:false, bye:false, skip:false}; order.push(id); };
  for (let r = 1; r <= R; r++) for (let i = 0; i < (P >> r); i++) add(`W${r}-${i}`, 'W', r, i, 2 * r - 2);
  for (let k = 1; k <= LR; k++){
    const key = k === 1 ? 1 : (k % 2 === 0 ? k + 1 : k + 0.5);
    for (let i = 0; i < (P >> (Math.floor((k + 1) / 2) + 1)); i++) add(`L${k}-${i}`, 'L', k, i, key);
  }
  add('GF', 'F', 1, 0, 1000);
  add('GF2', 'F', 2, 0, 1001);

  const seeds = seedOrder(P), n = br.entrants.length;
  const pl = s => s <= n ? br.entrants[s - 1].id : BYE;
  for (let i = 0; i < P / 2; i++) M[`W1-${i}`].s = [pl(seeds[2 * i]), pl(seeds[2 * i + 1])];

  const put = (id, slot, v) => { M[id].s[slot] = v; };
  const route = m => {
    if (m.b === 'W'){
      const r = m.r, i = m.i;
      if (r < R) put(`W${r + 1}-${i >> 1}`, i & 1, m.w); else put('GF', 0, m.w);
      if (r === 1) put(`L1-${i >> 1}`, i & 1, m.l);
      else { const cnt = P >> r, j = r % 2 === 0 ? cnt - 1 - i : i; put(`L${2 * (r - 1)}-${j}`, 1, m.l); }
    } else if (m.b === 'L'){
      const k = m.r;
      if (k === LR) put('GF', 1, m.w);
      else if (k % 2 === 1) put(`L${k + 1}-${m.i}`, 0, m.w);
      else put(`L${k + 1}-${m.i >> 1}`, m.i & 1, m.w);
    } else if (m.id === 'GF'){
      // Si gana quien viene invicto, se acaba. Si gana quien viene del repechaje, hay final decisiva.
      if (m.w === m.s[0]) M.GF2.skip = true; else M.GF2.s = [m.s[0], m.s[1]];
    }
  };

  br.results = br.results || {};
  const applied = new Set();
  let changed = true;
  while (changed){
    changed = false;
    for (const id of order){
      const m = M[id];
      if (m.done || m.skip) continue;
      const [a, b] = m.s;
      if (a == null || b == null) continue;
      if (a === BYE || b === BYE){
        m.bye = true; m.w = a === BYE ? b : a; m.l = a === BYE ? a : b;
      } else if (br.results[id] === a || br.results[id] === b){
        m.w = br.results[id]; m.l = m.w === a ? b : a; applied.add(id);
      } else continue;
      m.done = true; route(m); changed = true;
    }
  }
  for (const id of Object.keys(br.results)) if (!applied.has(id)) delete br.results[id];
  br.pulls = br.pulls || {};
  for (const id of order){
    const m = M[id], pulls = br.pulls[id];
    m.bo3 = m.b === 'F';
    if (pulls && (!m.bo3 || m.s.includes(null) || pulls.some(x => !m.s.includes(x)))) delete br.pulls[id];
    m.score = m.s.map(v => (br.pulls[id] || []).filter(x => x === v).length);
  }

  const fin = M.GF2.done ? M.GF2 : (M.GF.done && M.GF2.skip ? M.GF : null);
  let podium = null;
  if (fin){
    const real = v => v && v !== BYE ? v : null;
    podium = [fin.w, fin.l, real(M[`L${LR}-0`].l), LR > 1 ? real(M[`L${LR - 1}-0`].l) : null];
  }
  const live = order.map(id => M[id]).filter(m => !m.done && !m.skip && m.s[0] && m.s[1] && m.s[0] !== BYE && m.s[1] !== BYE);
  const total = order.filter(id => !M[id].bye && !M[id].skip).length;
  return {M, order, R, LR, P, podium, live, played:applied.size, total};
}

export function roundName(m, R, LR){
  if (m.b === 'W') return m.r === R ? 'Final de ganadores' : m.r === R - 1 ? 'Semifinal ganadores' : `Ronda ${m.r}`;
  if (m.b === 'L') return m.r === LR ? 'Final de repechaje' : LR > 1 && m.r === LR - 1 ? 'Por 3° y 4° lugar' : `Repechaje ${m.r}`;
  return m.id === 'GF' ? 'Final 1° y 2°' : 'Final decisiva';
}

// Todo a un pulso, salvo la final de 1°-2° (y su final decisiva), que va al mejor de 3.
export function addWin(br, m, p){
  if (!m.bo3){ br.results[m.id] = p; return; }
  const pulls = br.pulls[m.id] = br.pulls[m.id] || [];
  pulls.push(p);
  if (pulls.filter(x => x === p).length >= 2) br.results[m.id] = p;
}
export function undoWin(br, m){
  delete br.results[m.id];
  if (m.bo3 && br.pulls[m.id]){ br.pulls[m.id].pop(); if (!br.pulls[m.id].length) delete br.pulls[m.id]; }
}

export function catStatus(st, catId){
  const br = st.brackets[catId];
  if (!br) return 'open';
  return compute(br).podium ? 'end' : 'live';
}
export const statusText = {open:'Inscripción abierta', live:'En curso', end:'Terminada'};

/* ---------- datos de prueba ---------- */
function rngFrom(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function seedExample(){
  const rnd = rngFrom(2026);
  const first = ['Matías', 'Benjamín', 'Vicente', 'Martín', 'Sebastián', 'Diego', 'Felipe', 'Tomás', 'Joaquín', 'Nicolás', 'Cristóbal', 'Ignacio', 'Gonzalo', 'Rodrigo', 'Camilo', 'Francisco', 'Javier', 'Andrés', 'Pablo', 'Lucas', 'Agustín', 'Maximiliano', 'Bastián', 'Esteban', 'Mauricio', 'Claudio', 'Hernán', 'Patricio', 'Fernanda', 'Catalina', 'Javiera', 'Constanza', 'Daniela'];
  const last = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Reyes', 'Gutiérrez', 'Castro', 'Vargas', 'Álvarez', 'Tapia', 'Carrasco'];
  const others = ['Ing. en Maquinaria y Vehículos Pesados', 'Electricidad Industrial', 'Construcción Civil', 'Ingeniería Informática', 'Mecánica Industrial'];
  const pick = a => a[Math.floor(rnd() * a.length)];
  const course = career => `${career} · ${1 + Math.floor(rnd() * 4)}° año · Sec. ${pick(['101', '102', '201', '202', '301'])}`;
  const plan = {m70:[7, 58, 70], m80:[8, 70.1, 80], m90:[8, 80.1, 90], m100:[6, 90.1, 100], p100:[5, 100.1, 128]};
  const used = new Set(), people = [];
  const newName = () => { let name; do { name = pick(first) + ' ' + pick(last); } while (used.has(name)); used.add(name); return name; };
  for (const [cat, [count, lo, hi]] of Object.entries(plan)){
    for (let i = 0; i < count; i++){
      people.push({id:uid(), name:newName(), career:MECA, club:course(MECA), weight:Math.round((lo + rnd() * (hi - lo)) * 10) / 10, cats:[cat + 'd'], weighed:rnd() > 0.15});
    }
  }
  const shuffled = arr => arr.map(p => [rnd(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  shuffled(people.filter(p => p.weight > 75)).slice(0, 9).forEach(p => p.cats.push('ld'));
  shuffled(people.filter(p => p.weight > 72)).slice(0, 6).forEach(p => p.cats.push('li'));
  for (let i = 0; i < 7; i++){
    const career = pick(others), x = rnd();
    people.push({id:uid(), name:newName(), career, club:course(career), weight:Math.round((68 + rnd() * 45) * 10) / 10, cats:x < 0.5 ? ['ld', 'li'] : x < 0.8 ? ['ld'] : ['li'], weighed:rnd() > 0.15});
  }
  const st = {example:true, competitors:people, brackets:{}};
  const play = (catId, nResults) => {
    const br = makeBracket(people.filter(p => p.cats.includes(catId)), rnd);
    for (let t = 0; t < nResults; t++){
      const m = compute(br).live.sort((a, b) => a.key - b.key)[0];
      if (!m) break;
      addWin(br, m, m.s[rnd() < 0.55 ? 0 : 1]);
    }
    st.brackets[catId] = br;
  };
  play('m70d', 99);
  play('m80d', 6);
  play('ld', 11);
  return st;
}
