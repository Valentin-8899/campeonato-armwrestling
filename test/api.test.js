import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import estado from '../api/estado.js';
import inscribir from '../api/inscribir.js';
import {MECA} from '../motor.js';

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

  // El alumno sube su propia foto desde /mi-foto: queda por revisar y no se ve en público hasta aprobarla.
  const post = async body => { const req = Readable.from([JSON.stringify(body)]); Object.assign(req, {method:'POST', url:'/api/foto', headers:{}}); const res = {statusCode:200, headers:{}, setHeader(){}, end(b){ this.body = JSON.parse(b); }}; await foto(req, res); return {status:res.statusCode, ...res.body}; };
  assert.equal((await post({email:'nadie@mail.cl', foto:jpeg})).status, 404);
  await call(inscribir, 'POST', {name:'Bea Sinfoto', email:'bea@mail.cl', career:'otra', other:'Electricidad', weight:60, li:true});
  const propia = await post({email:' BEA@mail.cl ', foto:jpeg});
  assert.deepEqual([propia.status, propia.name], [200, 'Bea Sinfoto']);
  assert.equal((await call(estado, 'GET')).state.competitors.find(c => c.name === 'Bea Sinfoto').foto, undefined);
  assert.equal((await call(estado, 'GET', null, {'x-clave':'prueba'})).state.competitors.find(c => c.name === 'Bea Sinfoto').fotoRev, true);
  assert.equal((await post({email:'bea@mail.cl', foto:jpeg})).status, 409);

  const mala = await call(inscribir, 'POST', {name:'Otro Foto', email:'o@mail.cl', career:'otra', other:'X', weight:70, li:true, foto:'data:image/png;base64,AAAA'});
  assert.equal(mala.status, 400);
});

test('confirmación por correo con link personal para actualizar datos y foto', async () => {
  const {enviados} = await import('../lib/correo.js');
  const {default: misDatos} = await import('../api/mis-datos.js');
  const {default: confirmaciones} = await import('../api/confirmaciones.js');
  const r = await call(inscribir, 'POST', {name:'Caro Link', email:'caro@mail.cl', career:'meca', year:'3°', section:'301', weight:60, peso:true}, {host:'localhost:3000'});
  assert.equal(r.avisado, true);
  const m = enviados.find(x => x.to === 'caro@mail.cl');
  const t = /mis-datos\?t=([\w-]+)/.exec(m.text)[1];
  assert.match(m.text, /-70 kg/);
  assert.deepEqual(m.adjuntos, ['Bases Campeonato Lucha de Brazos 2026.pdf']);
  assert.match(m.text, /reglamento\.pdf/);

  const pub = await call(estado, 'GET');
  assert.equal(JSON.stringify(pub).includes(t), false);

  const ver = async (method, url, body) => {
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    Object.assign(req, {method, url, headers:{}});
    const res = {statusCode:200, headers:{}, setHeader(){}, end(b){ this.body = JSON.parse(b); }};
    await misDatos(req, res);
    return {status:res.statusCode, ...res.body};
  };
  assert.equal((await ver('GET', '/api/mis-datos?t=malo')).status, 404);
  const yo = await ver('GET', '/api/mis-datos?t=' + t);
  assert.deepEqual([yo.name, yo.year, yo.section, yo.foto], ['Caro Link', '3°', '301', 'sin']);
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64');
  const g = await ver('POST', '/api/mis-datos', {t, email:'Caro.Nueva@mail.cl', year:'4°', section:'401', foto:jpeg});
  assert.deepEqual([g.status, g.email, g.year, g.foto], [200, 'caro.nueva@mail.cl', '4°', 'revision']);
  const full = await call(estado, 'GET', null, {'x-clave':'prueba'});
  const caro = full.state.competitors.find(c => c.name === 'Caro Link');
  assert.equal(caro.club, `${MECA} · 4° año · Sec. 401`);
  assert.ok(caro.avisado && caro.fotoRev);

  // Los inscritos antes de esta función (sin link) reciben su confirmación desde el panel.
  full.state.competitors.push({id:'viejo1', name:'Viejo Uno', email:'viejo@mail.cl', career:MECA, club:MECA, weight:70, cats:['m70d'], weighed:false});
  assert.equal((await call(estado, 'PUT', {version:full.version, state:full.state}, {'x-clave':'prueba'})).status, 200);
  const viejos = full.state.competitors.filter(c => c.email && !c.avisado).length;
  assert.ok(viejos > 0);
  assert.equal((await call(confirmaciones, 'POST', null, {})).status, 401);
  const env = await call(confirmaciones, 'POST', null, {'x-clave':'prueba', host:'localhost:3000'});
  assert.equal(env.enviados + env.faltan, viejos);
  const viejo = (await call(estado, 'GET', null, {'x-clave':'prueba'})).state.competitors.find(c => c.id === 'viejo1');
  assert.ok(viejo.token && viejo.avisado);
  assert.ok(enviados.some(x => x.to === 'viejo@mail.cl' && x.text.includes(viejo.token)));
});
