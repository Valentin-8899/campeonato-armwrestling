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

test('la foto de la ficha se guarda aparte y se sirve como imagen', async () => {
  const {default: foto} = await import('../api/foto.js');
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
  const r = await call(inscribir, 'POST', {name:'Ana Foto', email:'ana@mail.cl', career:'otra', other:'Electricidad', weight:70, li:true, foto:jpeg});
  assert.equal(r.status, 200);
  const pub = await call(estado, 'GET');
  const ana = pub.state.competitors.find(c => c.name === 'Ana Foto');
  assert.equal(ana.foto, 1);

  const raw = async (method, url, headers = {}) => {
    const req = Readable.from([]);
    Object.assign(req, {method, url, headers});
    const res = {statusCode:200, headers:{}, setHeader(k, v){ this.headers[k] = v; }, end(b){ this.body = b; }};
    await foto(req, res);
    return res;
  };
  const img = await raw('GET', '/api/foto?id=' + ana.id);
  assert.equal(img.headers['Content-Type'], 'image/jpeg');
  assert.equal(img.body.toString(), 'fake-jpeg');
  assert.equal((await raw('DELETE', '/api/foto?id=' + ana.id)).statusCode, 401);
  assert.equal((await raw('DELETE', '/api/foto?id=' + ana.id, {'x-clave':'prueba'})).statusCode, 200);
  assert.equal((await raw('GET', '/api/foto?id=' + ana.id)).statusCode, 404);

  const mala = await call(inscribir, 'POST', {name:'Otro Foto', email:'o@mail.cl', career:'otra', other:'X', weight:70, li:true, foto:'data:image/png;base64,AAAA'});
  assert.equal(mala.status, 400);
});
