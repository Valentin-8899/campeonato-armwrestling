// POST (organizador): envía por correo el diploma digital con su nombre a los 1°, 2° y 3° de cada categoría terminada
// que aún no lo recibieron. Envía de a poco: el panel llama varias veces.
import {actualizar, read} from '../lib/store.js';
import {send, fail, isAdmin} from '../lib/http.js';
import {correoListo, enviarCorreo, correoDiploma} from '../lib/correo.js';
import {diplomaPDF} from '../lib/diploma.js';
import {ganadoresDiploma} from '../motor.js';

const POR_VEZ = 4;

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.setHeader('Allow', 'POST'); return send(res, 405, {error:'Método no permitido.'}); }
  if (!isAdmin(req)) return send(res, 401, {error:'Clave incorrecta.'});
  if (!correoListo()) return send(res, 503, {error:'sin_configurar'});
  try {
    const pendientes = ganadoresDiploma((await read()).state).filter(g => !g.enviado && g.c.email);
    let enviados = 0;
    for (const {c, cat, lugar} of pendientes.slice(0, POR_VEZ)){
      try {
        await enviarCorreo(correoDiploma(c, cat, lugar, await diplomaPDF(c.name, cat.id, lugar)));
      } catch (err){
        if (err.message !== 'sin_configurar') console.error('No se pudo enviar el diploma:', err.message);
        continue;
      }
      await actualizar(st => {
        const x = st.competitors.find(y => y.id === c.id);
        if (!x || (x.diplomas || []).includes(cat.id)) return {sinCambios:true};
        x.diplomas = [...(x.diplomas || []), cat.id];
      });
      enviados++;
    }
    if (pendientes.length && !enviados) return send(res, 502, {error:'Gmail no aceptó los envíos. Revisa el correo y la contraseña de aplicación en Vercel.'});
    send(res, 200, {enviados, faltan:Math.max(0, pendientes.length - enviados)});
  } catch (err){ fail(res, err); }
}
