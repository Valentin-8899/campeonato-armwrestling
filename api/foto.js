// GET ?id=…: foto de un competidor (pública, como las llaves).
// POST {email, foto}: un alumno inscrito y sin foto sube la suya (página /mi-foto, enlazada desde el correo de aviso).
// Esa foto queda por revisar: no se muestra en las páginas públicas hasta que el organizador la apruebe.
// PUT {id, foto} o DELETE ?id=…: el organizador agrega, cambia o quita una foto.
import {read, write, readFoto, writeFoto} from '../lib/store.js';
import {readJson, send, fail, isAdmin} from '../lib/http.js';
import {fotoB64} from '../motor.js';

export default async function handler(req, res){
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    if (req.method === 'GET'){
      const b64 = await readFoto(String(q.get('id') || '').slice(0, 20));
      if (!b64){ res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', 'image/jpeg');
      // La URL lleva la versión de la foto (&v=), así que puede guardarse en caché.
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(Buffer.from(b64, 'base64'));
    }
    if (req.method === 'POST') return subirPropia(req, res);
    if (!isAdmin(req)) return send(res, 401, {error:'Clave incorrecta.'});
    if (req.method === 'PUT'){
      const {id, foto} = await readJson(req);
      const b64 = fotoB64(foto);
      if (!id || !b64) return send(res, 400, {error:'La foto no se pudo usar.'});
      await writeFoto(String(id).slice(0, 20), b64);
      return send(res, 200, {ok:true});
    }
    if (req.method === 'DELETE'){
      await writeFoto(String(q.get('id') || '').slice(0, 20), null);
      return send(res, 200, {ok:true});
    }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    send(res, 405, {error:'Método no permitido.'});
  } catch (err){ fail(res, err); }
}

// Solo para quien aún no tiene foto: así nadie puede reemplazar la de otro. Para cambiarla, el organizador.
async function subirPropia(req, res){
  const {email, foto} = await readJson(req);
  const mail = String(email || '').trim().toLowerCase();
  const b64 = fotoB64(foto);
  if (!b64) return send(res, 400, {error:'La foto no se pudo usar. Prueba con otra.'});
  for (let i = 0; i < 6; i++){
    const {state, version} = await read();
    const c = state.competitors.find(x => x.email && x.email === mail);
    if (!c) return send(res, 404, {error:'No encontramos ese correo entre los inscritos. Escríbelo igual que en tu ficha.'});
    if (c.foto) return send(res, 409, {error:`${c.name}, ya tienes foto. Si quieres cambiarla, pídeselo al organizador.`});
    await writeFoto(c.id, b64);
    c.foto = 1;
    c.fotoRev = true;
    if (await write(version, state) !== null) return send(res, 200, {ok:true, name:c.name});
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
  }
  send(res, 503, {error:'Hay mucha gente usando la página. Intenta de nuevo en unos segundos.'});
}
