// Guarda el estado del torneo en Redis (Upstash, conectado desde Vercel).
// Sin base de datos configurada, en tu computador usa memoria; en Vercel avisa que falta conectarla.
import {emptyState, clean} from '../motor.js';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const K_STATE = 'aw:estado', K_VER = 'aw:version';

// Escribe solo si nadie más escribió desde que se leyó (misma versión).
const CAS = `local v = redis.call('GET', KEYS[2]) or '0'
if v ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], tostring(tonumber(v) + 1))
return 1`;

export class StoreMissing extends Error {}

const memory = {state:null, version:0};

async function redis(command){
  const r = await fetch(URL_, {method:'POST', headers:{Authorization:`Bearer ${TOKEN}`, 'Content-Type':'application/json'}, body:JSON.stringify(command)});
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis respondió ${r.status}`);
  return j.result;
}

function available(){
  if (URL_ && TOKEN) return true;
  if (process.env.VERCEL) throw new StoreMissing('Falta conectar la base de datos (Upstash) al proyecto en Vercel.');
  return false;
}

export async function read(){
  if (!available()) return {state:clean(structuredClone(memory.state) || emptyState()), version:memory.version};
  const [s, v] = await redis(['MGET', K_STATE, K_VER]);
  return {state:clean(s ? JSON.parse(s) : emptyState()), version:Number(v || 0)};
}

// Devuelve la nueva versión, o null si alguien escribió antes.
export async function write(version, state){
  if (!available()){
    if (version !== memory.version) return null;
    memory.state = structuredClone(state);
    return ++memory.version;
  }
  const ok = await redis(['EVAL', CAS, '2', K_STATE, K_VER, String(version), JSON.stringify(state)]);
  return ok === 1 ? version + 1 : null;
}
