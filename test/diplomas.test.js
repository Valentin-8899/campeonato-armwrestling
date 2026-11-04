import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import estado from '../api/estado.js';
import diplomas from '../api/diplomas.js';
import {enviados} from '../lib/correo.js';
import {diplomaPDF} from '../lib/diploma.js';
import {makeBracket, compute, addWin, ganadoresDiploma, MECA} from '../motor.js';

async function call(handler, method, body, headers = {}){
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, {method, headers});
  const res = {statusCode:200, headers:{}, setHeader(k, v){ this.headers[k] = v; }, end(b){ this.body = JSON.parse(b); }};
  await handler(req, res);
  return {status:res.statusCode, ...res.body};
}

test('el diploma digital es un PDF con el nombre del ganador', async () => {
  const pdf = await diplomaPDF('José Ñúñez Peña', 'm70d', 1);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 100000);
});

test('al terminar una categoría, 1°, 2° y 3° reciben su diploma por correo una sola vez', async () => {
  const people = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].map((n, i) => ({id:'p' + i, name:n + ' Soto', email:i === 4 ? '' : `${n.toLowerCase()}@mail.cl`, career:MECA, club:MECA, weight:65, cats:['m70d'], weighed:true}));
  const br = makeBracket(people, () => 0.5);
  // Gana siempre el primero de cada cruce hasta que haya podio.
  for (let r = compute(br); !r.podium; r = compute(br)) addWin(br, r.live[0], r.live[0].s[0]);
  const st = {competitors:people, brackets:{m70d:br}};
  const g = ganadoresDiploma(st);
  assert.deepEqual(g.map(x => x.lugar), [1, 2, 3]);

  const cur = await call(estado, 'GET', null, {'x-clave':'prueba'});
  assert.equal((await call(estado, 'PUT', {version:cur.version, state:st}, {'x-clave':'prueba'})).status, 200);
  assert.equal((await call(diplomas, 'POST')).status, 401);

  const r1 = await call(diplomas, 'POST', null, {'x-clave':'prueba'});
  const conCorreo = g.filter(x => x.c.email).length;
  assert.deepEqual([r1.status, r1.enviados, r1.faltan], [200, conCorreo, 0]);
  assert.equal(enviados.length, conCorreo);
  assert.match(enviados[0].subject, /Tu diploma: primer lugar en -70 kg/);
  assert.match(enviados[0].adjuntos[0], /^Diploma Primer lugar -70 kg - .+\.pdf$/);

  const r2 = await call(diplomas, 'POST', null, {'x-clave':'prueba'});
  assert.deepEqual([r2.enviados, r2.faltan], [0, 0]);
  const guardado = (await call(estado, 'GET', null, {'x-clave':'prueba'})).state;
  assert.ok(ganadoresDiploma(guardado).every(x => x.enviado || !x.c.email));
});
