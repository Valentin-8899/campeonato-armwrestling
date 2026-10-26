// POST: un alumno envía su ficha. Se valida contra el estado actual (cupos, carrera, duplicados).
import {read, write} from '../lib/store.js';
import {readJson, send, fail} from '../lib/http.js';
import {validarInscripcion, catById} from '../motor.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.setHeader('Allow', 'POST'); return send(res, 405, {error:'Método no permitido.'}); }
  try {
    const datos = await readJson(req);
    // Si otra persona guarda al mismo tiempo, se vuelve a leer y validar.
    for (let i = 0; i < 6; i++){
      const {state, version} = await read();
      const v = validarInscripcion(state, datos);
      if (v.error) return send(res, 400, {error:v.error});
      state.competitors.push(v.competitor);
      if (await write(version, state) !== null){
        const c = v.competitor;
        return send(res, 200, {ok:true, name:c.name, cats:c.cats.map(id => catById(id).label)});
      }
      await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
    }
    send(res, 503, {error:'Hay muchas inscripciones al mismo tiempo. Intenta de nuevo en unos segundos.'});
  } catch (err){ fail(res, err); }
}
