// El alumno, con el link personal de su correo de confirmación (?t=…), ve y corrige sus datos y sube su foto.
// GET ?t=…: sus datos. POST {t, email, year, section, foto?}: guarda los cambios.
// Una foto subida aquí queda por revisar hasta que el organizador la apruebe.
import {actualizar, read, writeFoto} from '../lib/store.js';
import {readJson, send, fail} from '../lib/http.js';
import {catById, clubDe, cursoDe, correoOk, fotoB64, YEARS, abierto, MSG_CERRADO} from '../motor.js';

const porToken = (st, t) => t && st.competitors.find(c => c.token && c.token === t);

function vista(c){
  const {year, section} = cursoDe(c);
  return {name:c.name, email:c.email || '', career:c.career, year, section, cats:c.cats.map(id => catById(id).label),
    foto:c.foto ? (c.fotoRev ? 'revision' : 'aprobada') : 'sin', id:c.id, v:c.foto || 0, abierto:abierto()};
}

export default async function handler(req, res){
  try {
    if (req.method === 'GET'){
      const t = new URL(req.url, 'http://x').searchParams.get('t');
      const c = porToken((await read()).state, t);
      if (!c) return send(res, 404, {error:'Este link no es válido. Revisa que lo copiaste completo del correo.'});
      return send(res, 200, vista(c));
    }
    if (req.method !== 'POST'){ res.setHeader('Allow', 'GET, POST'); return send(res, 405, {error:'Método no permitido.'}); }
    if (!abierto()) return send(res, 403, {error:MSG_CERRADO});
    const d = await readJson(req);
    const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
    const section = String(d.section || '').trim().replace(/\s+/g, ' ').slice(0, 20);
    const year = YEARS.includes(d.year) ? d.year : '';
    if (!correoOk(email)) return send(res, 400, {error:'Escribe un correo válido.'});
    const foto = d.foto ? fotoB64(d.foto) : null;
    if (d.foto && !foto) return send(res, 400, {error:'La foto no se pudo usar. Prueba con otra.'});
    let fotoId = null;
    const r = await actualizar(async st => {
      const c = porToken(st, d.t);
      if (!c) return {sinCambios:true, error:'Este link no es válido. Revisa que lo copiaste completo del correo.'};
      if (st.competitors.some(x => x !== c && x.email === email)) return {sinCambios:true, error:'Ese correo ya lo usa otro inscrito.'};
      if (foto && fotoId !== c.id){ await writeFoto(c.id, foto); fotoId = c.id; }
      Object.assign(c, {email, year, section, club:clubDe(c.career, year, section)});
      if (foto){ c.foto = (c.foto || 0) + 1; c.fotoRev = true; }
      return {c:vista(c)};
    });
    if (r.error) return send(res, 400, {error:r.error});
    send(res, 200, r.c);
  } catch (err){ fail(res, err); }
}
