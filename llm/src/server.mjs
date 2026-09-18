import {createServer} from 'node:http';
import {timingSafeEqual, createHash} from 'node:crypto';
import {generate} from './client.mjs';
import {selectProfile, resolveKey} from './config.mjs';
import {LlmError, onlyKeys, publicError, requireValue} from './errors.mjs';

function sameSecret(a,b) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve,reject) => {
    const chunks = []; let bytes = 0, failed = false;
    req.on('data', chunk => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > limit) {failed = true; chunks.length = 0; reject(new LlmError('REQUEST_SIZE','Request body is too large.'));}
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try {resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
      catch {reject(new LlmError('REQUEST','Expected a JSON request body.'));}
    });
    req.on('error', () => reject(new LlmError('CANCELLED','Request disconnected.')));
  });
}
/** Local server accepts profile names, never client-supplied endpoints or secrets. */
export function createLlmServer({config,secrets,env = process.env,generateImpl = generate}) {
  const token = env[config.server?.tokenEnv ?? 'ABYSSA_LLM_SERVER_TOKEN'] || secrets.serverToken || '';
  requireValue(typeof token === 'string' && token.length >= 24 && !/[\r\n]/.test(token), 'Set a separate local server token of at least 24 characters before serving.', 'AUTH_CONFIG');
  const origins = config.server?.allowedOrigins ?? [];
  let active = 0;
  const server = createServer(async (req,res) => {
    res.setHeader('cache-control','no-store');
    res.setHeader('x-content-type-options','nosniff');
    const send = (status,data) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, {'content-type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data));
    };
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) return send(403,{error:{code:'ORIGIN',message:'Origin is not allowed.'}});
    if (origin) {res.setHeader('access-control-allow-origin',origin); res.setHeader('vary','Origin');}
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-methods','POST, GET');
      res.setHeader('access-control-allow-headers','authorization, content-type');
      res.writeHead(204); res.end(); return;
    }
    if (req.url === '/health' && req.method === 'GET') return send(200,{status:'ok',schemaVersion:1});
    if (req.url !== '/v1/generate' || req.method !== 'POST') return send(404,{error:{code:'NOT_FOUND',message:'Unknown endpoint.'}});
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ') || !sameSecret(auth.slice(7),token)) return send(401,{error:{code:'UNAUTHORIZED',message:'Valid local server token required.'}});
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:{code:'REQUEST',message:'Use application/json.'}});
    if (active >= 2) return send(429,{error:{code:'BUSY',message:'Two calls are already in progress.'}});
    active++;
    const abort = new AbortController();
    const disconnect = () => {if (!res.writableEnded) abort.abort();};
    res.on('close',disconnect);
    try {
      const body = await readBody(req);
      onlyKeys(body,['profile','request'],'API request','REQUEST');
      requireValue(body.profile === undefined || typeof body.profile === 'string','Invalid profile identifier.','REQUEST');
      const p = selectProfile(config,body.profile);
      const result = await generateImpl({profile:p,apiKey:resolveKey(p,secrets,env),request:body.request,signal:abort.signal});
      send(200,{schemaVersion:1,result});
    } catch (error) {
      const e = publicError(error);
      const status = ['REQUEST','CONTEXT_BUDGET'].includes(e.code) ? 400 : e.code === 'REQUEST_SIZE' ? 413 : e.code === 'TIMEOUT' ? 504 : e.code === 'CANCELLED' ? 499 : ['CONFIG','AUTH_CONFIG'].includes(e.code) ? 503 : 502;
      send(status,{error:e});
    } finally {active--; res.off('close',disconnect);}
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
