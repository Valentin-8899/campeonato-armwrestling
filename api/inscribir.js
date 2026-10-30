// POST: un alumno envía su ficha. Se valida contra el estado actual (cupos, carrera, duplicados).
// Si el correo está configurado, le llega una confirmación con su link personal para actualizar datos y foto.
import {randomBytes} from 'node:crypto';
import {read, write, writeFoto, actualizar} from '../lib/store.js';
import {readJson, send, fail} from '../lib/http.js';
import {enviarCorreo, correoConfirmacion, origen} from '../lib/correo.js';
import {validarInscripcion, catById, fotoB64, abierto, MSG_CERRADO} from '../motor.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.setHeader('Allow', 'POST'); return send(res, 405, {error:'Método no permitido.'}); }
  try {
    if (!abierto()) return send(res, 403, {error:MSG_CERRADO});
    const datos = await readJson(req);
    const foto = datos.foto ? fotoB64(datos.foto) : null;
    if (datos.foto && !foto) return send(res, 400, {error:'La foto no se pudo usar. Prueba con otra o inscríbete sin foto.'});
    // Si otra persona guarda al mismo tiempo, se vuelve a leer y validar.
    for (let i = 0; i < 6; i++){
      const {state, version} = await read();
      const v = validarInscripcion(state, datos);
      if (v.error) return send(res, 400, {error:v.error});
      const c = v.competitor;
      c.token = randomBytes(16).toString('base64url');
      // La foto se guarda antes que la ficha: si la ficha no alcanza a guardarse, queda una foto sin uso.
      if (foto){ await writeFoto(c.id, foto); c.foto = 1; }
      state.competitors.push(c);
      if (await write(version, state) !== null){
        const avisado = await confirmar(c, origen(req));
        return send(res, 200, {ok:true, name:c.name, cats:c.cats.map(id => catById(id).label), avisado});
      }
      await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
    }
    send(res, 503, {error:'Hay muchas inscripciones al mismo tiempo. Intenta de nuevo en unos segundos.'});
  } catch (err){ fail(res, err); }
}

// Envía la confirmación y lo anota. Si el correo falla, la inscripción ya quedó igual.
export async function confirmar(c, base){
  try {
    await enviarCorreo(correoConfirmacion(c, base));
    await actualizar(st => { const x = st.competitors.find(y => y.id === c.id); if (!x) return {sinCambios:true}; x.avisado = Date.now(); });
    return true;
  } catch (err){
    if (err.message !== 'sin_configurar') console.error('No se pudo enviar la confirmación:', err.message);
    return false;
  }
}
