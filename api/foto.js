// GET ?id=…: foto de un competidor (pública, como las llaves).
// PUT {id, foto} o DELETE ?id=…: el organizador agrega, cambia o quita una foto.
import {readFoto, writeFoto} from '../lib/store.js';
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
