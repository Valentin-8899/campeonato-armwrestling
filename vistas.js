// Vistas de llaves y podio. Las usan el panel del organizador (editable) y la página pública (solo lectura).
import {CATS, BYE, catById, members, compute, roundName, catStatus, statusText, esc} from './motor.js';

const bo3Text = m => `Mejor de 3 · ${m.score[0]}–${m.score[1]}`;
const nameOf = (br, id) => br.entrants.find(e => e.id === id) || {name:'—', club:''};

export function catChips(S, current){
  const chip = c => { const st = catStatus(S, c.id); return `<button data-act="cat" data-cat="${c.id}" aria-pressed="${current === c.id}" title="${c.label}: ${statusText[st]}"><span class="dot ${st}"></span>${c.weight}</button>`; };
  return `<div class="catgroups">
    <div class="cats"><button class="live-btn" data-act="cat" data-cat="vivo" aria-pressed="${current === 'vivo'}"><span class="dot live"></span>Luchas por jugar</button></div>
    ${[['peso', 'd', 'Peso (derecho)'], ['libre', 'i', 'Libres']].map(([g, cls, name]) => `<div class="cats" role="group" aria-label="${name}"><span class="armlbl ${cls}">${name}</span>${CATS.filter(c => c.group === g).map(chip).join('')}</div>`).join('')}
  </div>`;
}

export function viewVivo(S, editable){
  const bouts = [], prog = [];
  for (const c of CATS){
    const br = S.brackets[c.id];
    if (!br) continue;
    const r = compute(br);
    prog.push(`<div class="p"><div class="row" style="justify-content:space-between"><strong>${c.label}</strong><span class="num">${r.played}/${r.total}</span></div><span class="bar"><i class="${r.podium ? 'end' : ''}" style="width:${r.played / r.total * 100}%"></i></span><span class="hint">${r.podium ? 'Campeón: ' + esc(nameOf(br, r.podium[0]).name) : statusText.live}</span></div>`);
    for (const m of r.live) bouts.push({c, m, br, R:r.R, LR:r.LR});
  }
  bouts.sort((a, b) => a.m.key - b.m.key || CATS.indexOf(a.c) - CATS.indexOf(b.c));
  const cards = bouts.map(({c, m, br, R, LR}) => {
    const p = i => {
      const e = nameOf(br, m.s[i]);
      const inner = `<strong>${esc(e.name)}</strong><span>${esc(e.club || '')}</span>`;
      if (!editable) return `<div class="pick static">${inner}${m.bo3 ? `<em>${m.score[i]} pulso${m.score[i] === 1 ? '' : 's'}</em>` : ''}</div>`;
      return `<button class="pick" data-act="win" data-cat="${c.id}" data-m="${m.id}" data-p="${m.s[i]}">${inner}<em>${m.bo3 ? `Gana pulso · lleva ${m.score[i]}` : 'Marcar ganador'}</em></button>`;
    };
    return `<div class="bout"><div class="bh"><b>${c.label}</b><span>${roundName(m, R, LR)}${m.bo3 ? ' · ' + bo3Text(m) : ''}</span></div><div class="vs">${p(0)}<span class="x">VS</span>${p(1)}</div></div>`;
  }).join('');
  const pending = CATS.filter(c => !S.brackets[c.id]).map(c => c.label);
  const empty = editable ? 'No hay luchas pendientes. Sortea una llave desde su categoría para empezar.' : 'No hay luchas por jugar en este momento.';
  return `<section class="bsec"><h2>${editable ? 'Luchas listas para jugar' : 'Próximas luchas'}</h2>
      <p class="muted">${editable ? 'Todas las categorías juntas, en orden de ronda. Toca el nombre de quien ganó y la llave avanza sola.' : 'Todas las categorías juntas, en orden de ronda. Se actualiza sola.'}</p>
      ${cards ? `<div class="bouts">${cards}</div>` : `<p class="empty">${empty}</p>`}
    </section>
    ${prog.length ? `<section class="bsec"><h3>Avance por categoría</h3><div class="prog">${prog.join('')}</div></section>` : ''}
    ${pending.length ? `<p class="hint">Sin sortear todavía: ${pending.join(', ')}.</p>` : ''}`;
}

// confirmBtn solo se usa en modo editable.
export function viewCategoria(S, catId, editable, confirmBtn){
  const c = catById(catId), br = S.brackets[catId];
  if (!br){
    const list = members(S, catId);
    const notW = list.filter(p => p.weighed === false).length;
    return `<section class="panel">
      <div class="row" style="justify-content:space-between"><h2>${c.label}</h2><span class="num">${list.length}/${c.max} inscritos</span></div>
      ${list.length ? `<div class="row">${list.map(p => `<span class="chip">${esc(p.name)}${editable && p.weight ? ' · ' + p.weight.toFixed(1) : ''}</span>`).join('')}</div>` : '<p class="empty">Nadie inscrito en esta categoría todavía.</p>'}
      ${editable && notW ? `<p class="hint">${notW} sin pesaje confirmado.</p>` : ''}
      ${editable ? `<div class="row"><button class="btn primary" data-act="gen" data-cat="${catId}" ${list.length < 2 ? 'disabled' : ''}>Sortear y generar llave</button>
      <span class="hint">El sorteo ubica a los competidores al azar y cierra la inscripción de esta categoría.</span></div>` : '<p class="hint">La llave se publica aquí cuando el organizador haga el sorteo.</p>'}
    </section>`;
  }
  const r = compute(br);
  const card = m => {
    const slot = i => {
      const v = m.s[i];
      if (v == null) return `<div class="slot tbd"><span class="nm">Por definir</span></div>`;
      const e = nameOf(br, v);
      const can = editable && !m.done && m.s[0] && m.s[1] && m.s[0] !== BYE && m.s[1] !== BYE;
      const cls = (m.done ? (m.w === v ? 'win' : 'lose') : '') + (can ? ' can' : '');
      const inner = `<span class="nm">${esc(e.name)}<span class="club">${esc(e.club || '')}</span></span>${m.bo3 && v !== BYE ? `<span class="sc">${m.score[i]}</span>` : ''}<span class="tag">GANA</span>`;
      return can ? `<button class="slot ${cls}" data-act="win" data-cat="${catId}" data-m="${m.id}" data-p="${v}" title="${m.bo3 ? 'Sumar pulso ganado' : 'Marcar ganador'}">${inner}</button>` : `<div class="slot ${cls}">${inner}</div>`;
    };
    const ready = !m.done && m.s[0] && m.s[1];
    const label = m.bo3 ? bo3Text(m) : m.done ? 'Jugada' : ready ? 'Lista para jugar' : 'En espera';
    const undo = editable && (br.results[m.id] || (br.pulls[m.id] || []).length);
    const foot = `<span>${label}</span>${undo ? `<button data-act="undo" data-cat="${catId}" data-m="${m.id}">${m.bo3 ? 'Deshacer pulso' : 'Deshacer'}</button>` : ''}`;
    return `<div class="match ${m.b} ${ready ? 'ready' : ''}">${slot(0)}${slot(1)}<div class="mfoot">${foot}</div></div>`;
  };
  const column = (title, ms) => {
    const vis = ms.filter(m => !m.bye && !m.skip);
    return vis.length ? `<div class="round"><span class="rt">${title}</span><div class="rcol">${vis.map(card).join('')}</div></div>` : '';
  };
  const byRound = (b, k) => r.order.map(id => r.M[id]).filter(m => m.b === b && m.r === k);
  let W = '', L = '';
  for (let k = 1; k <= r.R; k++) W += column(roundName(byRound('W', k)[0], r.R, r.LR), byRound('W', k));
  for (let k = 1; k <= r.LR; k++) L += column(roundName(byRound('L', k)[0], r.R, r.LR), byRound('L', k));
  const F = column('Final 1° y 2°', [r.M.GF]) + column('Final decisiva', [r.M.GF2]);
  const pod = r.podium ? `<section class="panel podio"><h3>Podio ${c.label}</h3>${podiumList(br, r.podium)}</section>` : '';
  return `${pod}
    <div class="row" style="justify-content:space-between"><div><h2>${c.label}</h2><p class="muted">${br.entrants.length} competidores · ${r.played} de ${r.total} luchas jugadas</p></div>
    ${editable ? confirmBtn('reset-' + catId, 'Volver a sortear', 'Sí, borrar resultados y sortear', 'reset', `data-cat="${catId}"`) : ''}</div>
    <section class="bsec"><h3>Llave de ganadores <small>nadie ha perdido</small></h3><div class="rounds">${W}</div></section>
    <section class="bsec"><h3>Repechaje <small>una derrota; la segunda elimina</small></h3><div class="rounds">${L}</div></section>
    <section class="bsec"><h3>Final <small>al mejor de 3 pulsos; si gana quien viene del repechaje, se juega una final decisiva</small></h3><div class="rounds">${F}</div></section>`;
}

function podiumList(br, pod){
  return `<ol>${pod.map((id, i) => id ? `<li><span class="pl">${i + 1}°</span><span>${esc(nameOf(br, id).name)}<small>${esc(nameOf(br, id).club || '')}</small></span></li>` : '').join('')}</ol>`;
}

export function viewPodio(S){
  const cards = CATS.map(c => {
    const br = S.brackets[c.id];
    const r = br ? compute(br) : null;
    const body = !br ? '<p class="empty">Llave sin sortear.</p>' : r.podium ? podiumList(br, r.podium) : `<p class="empty">En curso: ${r.played} de ${r.total} luchas.</p>`;
    return `<section class="panel podio"><h3>${c.label}</h3>${body}</section>`;
  }).join('');
  return `<h2>Podio por categoría</h2><div class="podios">${cards}</div>`;
}

export function viewCupos(S){
  return CATS.map(c => {
    const k = members(S, c.id).length, full = k >= c.max, closed = !!S.brackets[c.id];
    return `<div class="cupo"><span>${c.label}</span><span class="bar"><i class="${full ? 'full' : ''}" style="width:${Math.min(100, k / c.max * 100)}%"></i></span><span class="num">${closed ? 'Cerrada' : `${k}/${c.max}`}</span></div>`;
  }).join('');
}
