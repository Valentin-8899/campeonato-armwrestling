// Servidor para probar en tu computador: `npm run dev` y abre http://localhost:3000
// Usa memoria en vez de base de datos y la clave de organizador "prueba".
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import estado from './api/estado.js';
import inscribir from './api/inscribir.js';
import foto from './api/foto.js';
import misDatos from './api/mis-datos.js';
import confirmaciones from './api/confirmaciones.js';

const root = new URL('.', import.meta.url).pathname;
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.pdf':'application/pdf'};
const api = {'/api/estado':estado, '/api/inscribir':inscribir, '/api/foto':foto, '/api/mis-datos':misDatos, '/api/confirmaciones':confirmaciones};

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (api[path]) return api[path](req, res);
  let file = path === '/' ? '/index.html' : path;
  if (!extname(file)) file += '.html';
  const full = normalize(join(root, file));
  if (!full.startsWith(root) || /\/(lib|api|test)\//.test(full)){ res.statusCode = 404; return res.end('No encontrado'); }
  try {
    const body = await readFile(full);
    res.setHeader('Content-Type', types[extname(full)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('No encontrado'); }
}).listen(process.env.PORT || 3000, () => console.log(`Listo en http://localhost:${process.env.PORT || 3000}`));
