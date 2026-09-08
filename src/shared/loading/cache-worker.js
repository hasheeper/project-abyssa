/* GAME_ASSETS is injected by the build. Only this deployment's declared files are cached.
 * No saves, API responses, other applications or arbitrary URLs enter this cache. */
const base = new URL('./', self.location.href);
const cacheName = 'abyssa-assets-v1:' + base.pathname;
const entries = new Map(GAME_ASSETS.assets.map(asset => [new URL(asset.url, base).pathname, asset]));
const pending = new Map();
const subscribers = new Set();
let preparation;
const storage = caches.open(cacheName).catch(() => null);
const keyFor = asset => new URL('__asset_cache__/' + asset.revision, base).href;
const manifestPath = new URL('game-assets.json', base).pathname;
const historyKey = new URL('__asset_cache__/versions', base).href;
const history = storage.then(async cache => {
  try { return await (await cache?.match(historyKey))?.json() ?? []; }
  catch { return []; }
});

async function rememberVersion() {
  const cache = await storage;
  const versions = [GAME_ASSETS, ...(await history).filter(version => version.version !== GAME_ASSETS.version)].slice(0, 2);
  await cache?.put(historyKey, new Response(JSON.stringify(versions), {headers: {'content-type':'application/json'}})).catch(() => {});
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function getAsset(asset) {
  const key = keyFor(asset), cache = await storage;
  const cached = await cache?.match(key).catch(() => undefined);
  if (cached) return cached;
  if (!pending.has(key)) {
    const work = (async () => {
      let failure;
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(new URL(asset.url, base), {cache: attempt ? 'reload' : 'force-cache', signal: controller.signal});
          if (!response.ok || response.type === 'opaque') throw new Error('Resource unavailable: ' + asset.url);
          const bytes = await response.clone().arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
          // Also rejects a host's 200 HTML fallback, truncated transfers and stale unversioned art.
          if (hash !== asset.revision) throw new Error('Resource version mismatch: ' + asset.url);
          await cache?.put(key, response.clone()).catch(() => {}); // Private/quota-limited hosts retain the HTTP cache fallback.
          return response;
        } catch (error) { failure = error; }
        finally { clearTimeout(timeout); }
      }
      throw failure;
    })();
    pending.set(key, work);
    work.finally(() => pending.delete(key)).catch(() => {});
  }
  return (await pending.get(key)).clone();
}

function publish(message) { for (const port of subscribers) port.postMessage(message); }
async function prepare() {
  const totalBytes = GAME_ASSETS.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const cache = await storage;
  const existing = new Set((await cache?.keys().catch(() => []) ?? []).map(key => key.url));
  if (GAME_ASSETS.assets.every(asset => existing.has(keyFor(asset)))) {
    publish({type: 'progress', completed: GAME_ASSETS.assets.length, total: GAME_ASSETS.assets.length, loadedBytes: totalBytes, totalBytes});
    await rememberVersion();
    return;
  }
  let cursor = 0, completed = 0, loadedBytes = 0;
  const failures = [];
  const step = async () => {
    while (cursor < GAME_ASSETS.assets.length) {
      const asset = GAME_ASSETS.assets[cursor++];
      try { if (!existing.has(keyFor(asset))) await getAsset(asset); loadedBytes += asset.bytes; }
      catch { failures.push(asset.url); }
      completed++;
      publish({type: 'progress', completed, total: GAME_ASSETS.assets.length, loadedBytes, totalBytes});
    }
  };
  await Promise.all(Array.from({length: 6}, step));
  if (failures.length) throw new Error(failures.join('\n'));
  await rememberVersion();
  // Shared content keys prevent duplicates within/across releases. Remove obsolete bytes only
  // once a complete release is available; an interrupted update never erases usable resources.
  // Another open tab may still be using the previous build. Keep its old bytes alive.
  const windows = await self.clients.matchAll({type: 'window'});
  if (cache && windows.length <= 1) {
    const retained = new Set([historyKey, ...GAME_ASSETS.assets.map(keyFor)]);
    for (const key of await cache.keys().catch(() => [])) if (!retained.has(key.url)) await cache.delete(key).catch(() => {});
  }
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare' || !event.ports[0]) return;
  const port = event.ports[0];
  if (event.data.version !== GAME_ASSETS.version) { port.postMessage({type: 'error', message: 'version-mismatch'}); return; }
  subscribers.add(port);
  if (!preparation) preparation = prepare().finally(() => { preparation = undefined; });
  event.waitUntil(preparation.then(
    () => port.postMessage({type: 'ready'}),
    error => port.postMessage({type: 'error', message: String(error)}),
  ).finally(() => { subscribers.delete(port); port.close(); }));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== base.origin) return;
  if (url.pathname === manifestPath) {
    // Revalidate release metadata; offline clients use the manifest belonging to this worker.
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify(GAME_ASSETS), {headers: {'content-type': 'application/json'}})));
    return;
  }
  const asset = entries.get(url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
  if (!asset) {
    // Existing tabs can still request a previous build's hashed chunk after an update.
    // Its manifest and verified bytes are retained while another tab is open.
    if (url.pathname.startsWith(new URL('assets/', base).pathname)) event.respondWith((async () => {
      const prior = (await history).flatMap(version => version.assets).find(item => new URL(item.url, base).pathname === url.pathname);
      return prior ? getAsset(prior) : fetch(event.request);
    })());
    return;
  }
  if (event.request.mode === 'navigate') {
    // Fresh HTML may point at a new build. Never pin navigation to an old cached release.
    event.respondWith(fetch(event.request).catch(() => getAsset(asset)));
  } else event.respondWith(getAsset(asset));
});
