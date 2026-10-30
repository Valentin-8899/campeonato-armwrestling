import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import estado from '../api/estado.js';
import inscribir from '../api/inscribir.js';

// Llama a una función de /api como lo haría Vercel, sin servidor.
async function call(handler, method, body, headers = {}){
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, {method, headers});
  const res = {statusCode:200, headers:{}, setHeader(k, v){ this.headers[k] = v; }, end(b){ this.body = JSON.parse(b); }};
  await handler(req, res);
  return {status:res.statusCode, ...res.body};
}

test('inscripción pública, vista pública sin pesos y guardado del organizador con control de versión', async () => {
  const r1 = await call(inscribir, 'POST', {name:'Pedro Soto', email:'Pedro@Inacapmail.cl', career:'meca', year:'1°', weight:'85', peso:true});
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.cats, ['-90 kg']);

  const pub = await call(estado, 'GET');
  assert.equal(pub.state.competitors[0].name, 'Pedro Soto');
  assert.equal(pub.state.competitors[0].weight, undefined);
  assert.equal(pub.state.competitors[0].email, undefined);

  assert.equal((await call(estado, 'GET', null, {'x-clave':'mala'})).status, 401);
  const full = await call(estado, 'GET', null, {'x-clave':'prueba'});
  assert.equal(full.state.competitors[0].weight, 85);
  assert.equal(full.state.competitors[0].email, 'pedro@inacapmail.cl');

  full.state.competitors[0].weighed = true;
  const ok = await call(estado, 'PUT', {version:full.version, state:full.state}, {'x-clave':'prueba'});
  assert.equal(ok.version, full.version + 1);

  // Un guardado sobre una versión vieja se rechaza y devuelve el estado actual.
  const stale = await call(estado, 'PUT', {version:full.version, state:full.state}, {'x-clave':'prueba'});
  assert.equal(stale.status, 409);
  assert.equal(stale.version, ok.version);

  assert.equal((await call(estado, 'PUT', {version:ok.version, state:full.state}, {'x-clave':'mala'})).status, 401);
  const bad = await call(inscribir, 'POST', {name:'Luis', email:'luis@mail.cl', career:'otra', other:'Electricidad', weight:90, peso:true});
  assert.equal(bad.status, 400);
});
