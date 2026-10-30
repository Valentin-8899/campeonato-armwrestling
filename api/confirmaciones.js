// POST (organizador): envía la confirmación con link personal a los inscritos con correo que aún no la recibieron
// (por ejemplo, los que se inscribieron antes de que existiera). Envía de a poco: el panel llama varias veces.
import {randomBytes} from 'node:crypto';
import {actualizar, read} from '../lib/store.js';
import {send, fail, isAdmin} from '../lib/http.js';
import {correoListo, origen} from '../lib/correo.js';
import {confirmar} from './inscribir.js';

const POR_VEZ = 5;

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.setHeader('Allow', 'POST'); return send(res, 405, {error:'Método no permitido.'}); }
  if (!isAdmin(req)) return send(res, 401, {error:'Clave incorrecta.'});
  if (!correoListo()) return send(res, 503, {error:'sin_configurar'});
  try {
    // Primero se asegura que cada uno tenga su link personal.
    await actualizar(st => {
      const sin = st.competitors.filter(c => !c.token);
      if (!sin.length) return {sinCambios:true};
      for (const c of sin) c.token = randomBytes(16).toString('base64url');
    });
    const pendientes = (await read()).state.competitors.filter(c => c.email && !c.avisado);
    let enviados = 0;
    for (const c of pendientes.slice(0, POR_VEZ)) if (await confirmar(c, origen(req))) enviados++;
    if (pendientes.length && !enviados) return send(res, 502, {error:'Gmail no aceptó los envíos. Revisa el correo y la contraseña de aplicación en Vercel.'});
    send(res, 200, {enviados, faltan:Math.max(0, pendientes.length - enviados)});
  } catch (err){ fail(res, err); }
}
