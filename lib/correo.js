// Envío de correos automáticos desde el Gmail del organizador.
// En Vercel se configuran GMAIL_USUARIO (la dirección) y GMAIL_CLAVE_APP (una "contraseña de aplicación" de Google).
// Sin esas variables no se envía nada: la inscripción funciona igual. En tu computador los correos se guardan en `enviados`.
import nodemailer from 'nodemailer';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {catById, esc} from '../motor.js';

const USUARIO = process.env.GMAIL_USUARIO;
const CLAVE = (process.env.GMAIL_CLAVE_APP || '').replace(/\s+/g, '');

export const correoListo = () => !!(USUARIO && CLAVE) || !process.env.VERCEL;
export const enviados = [];

let transporte = null;
// Las bases van adjuntas en el correo de confirmación (y también con link, por si el adjunto no llega).
let bases;
function adjuntoBases(){
  if (bases === undefined){
    try { bases = readFileSync(join(process.cwd(), 'reglamento.pdf')); } catch { bases = null; }
  }
  return bases ? [{filename:'Bases Campeonato Lucha de Brazos 2026.pdf', content:bases, contentType:'application/pdf'}] : [];
}

export async function enviarCorreo({to, subject, text, html, attachments = []}){
  if (!USUARIO || !CLAVE){
    if (process.env.VERCEL) throw new Error('sin_configurar');
    enviados.push({to, subject, text, adjuntos:attachments.map(a => a.filename)});
    if (!process.env.NODE_TEST_CONTEXT) console.log(`[correo de prueba] Para: ${to}\n${text}\n`);
    return;
  }
  transporte ||= nodemailer.createTransport({service:'gmail', auth:{user:USUARIO, pass:CLAVE}});
  await transporte.sendMail({from:`Campeonato de Lucha de Brazos <${USUARIO}>`, to, subject, text, html, attachments});
}

// Dirección del sitio tal como la abrió el alumno (sirve igual en Vercel y en tu computador).
export function origen(req){
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function correoConfirmacion(c, base){
  const link = `${base}/mis-datos?t=${c.token}`;
  const cats = c.cats.map(id => catById(id).label).join(', ');
  const subject = 'Inscripción confirmada · Campeonato de Lucha de Brazos Mecánica 2026';
  const text = `Hola ${c.name}:

Quedaste inscrito en el Campeonato de Lucha de Brazos Mecánica 2026.

Categorías: ${cats}
Fecha: 24 de noviembre, 14:00 hrs
Lugar: Salón Auditorium

Para subir tu foto o corregir tu correo, año o sección, entra a tu link personal (no lo compartas):
${link}

Te adjuntamos las bases del campeonato. Léelas antes de competir; también están en ${base}/reglamento.pdf

Las llaves en vivo estarán en ${base}/llaves

¡Nos vemos en el campeonato!`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#15181D;max-width:520px">
  <p style="font-size:20px;font-weight:bold;margin:0 0 4px">Campeonato de <span style="color:#C42B1C">Lucha de Brazos</span> Mecánica 2026</p>
  <p style="margin:0 0 16px;color:#5A6271">24 de noviembre · 14:00 hrs · Salón Auditorium</p>
  <p>Hola <strong>${esc(c.name)}</strong>, quedaste inscrito en: <strong>${esc(cats)}</strong>.</p>
  <p>Para subir tu foto o corregir tu correo, año o sección, entra a tu link personal (no lo compartas):</p>
  <p><a href="${link}" style="display:inline-block;background:#C42B1C;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:6px">Actualizar mis datos y foto</a></p>
  <p>Te adjuntamos las <strong>bases del campeonato</strong>. Léelas antes de competir; también puedes verlas <a href="${base}/reglamento.pdf">aquí</a>.</p>
  <p style="color:#5A6271;font-size:13px">Las llaves en vivo estarán en <a href="${base}/llaves">${base}/llaves</a></p>
  <p>¡Nos vemos en el campeonato!</p>
</div>`;
  return {to:c.email, subject, text, html, attachments:adjuntoBases()};
}
