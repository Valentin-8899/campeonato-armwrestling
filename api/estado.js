// GET: estado público (o completo, con la clave del organizador).
// PUT: el organizador guarda el estado completo, indicando la versión sobre la que trabajó.
import {read, write} from '../lib/store.js';
import {readJson, send, isAdmin, fail} from '../lib/http.js';
import {publicState, clean} from '../motor.js';

export default async function handler(req, res){
  try {
    if (req.method === 'GET'){
      const {state, version} = await read();
      if (req.headers['x-clave'] !== undefined){
        if (!isAdmin(req)) return send(res, 401, {error:'Clave incorrecta.'});
        return send(res, 200, {state, version});
      }
      return send(res, 200, {state:publicState(state), version});
    }
    if (req.method === 'PUT'){
      if (!isAdmin(req)) return send(res, 401, {error:'Clave incorrecta.'});
      const body = await readJson(req);
      if (!body.state || !Array.isArray(body.state.competitors) || !Number.isInteger(body.version)) return send(res, 400, {error:'Datos inválidos.'});
      const version = await write(body.version, clean(body.state));
      if (version === null){
        const cur = await read();
        return send(res, 409, {state:cur.state, version:cur.version});
      }
      return send(res, 200, {version});
    }
    res.setHeader('Allow', 'GET, PUT');
    send(res, 405, {error:'Método no permitido.'});
  } catch (err){ fail(res, err); }
}
