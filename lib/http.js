import {timingSafeEqual} from 'node:crypto';
import {StoreMissing} from './store.js';

export async function readJson(req){
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req){ raw += chunk; if (raw.length > 1e6) throw new Error('too_large'); }
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// La clave del organizador se define en Vercel como variable ADMIN_CLAVE.
export function isAdmin(req){
  const expected = process.env.ADMIN_CLAVE || (process.env.VERCEL ? '' : 'prueba');
  const given = String(req.headers['x-clave'] || '');
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function fail(res, err){
  if (err instanceof StoreMissing) return send(res, 503, {error:err.message});
  console.error(err);
  send(res, 500, {error:'Algo falló en el servidor. Intenta de nuevo en un momento.'});
}
