export type GameAsset = {url: string; bytes: number; revision: string};
export type GameAssetManifest = {version: string; development: boolean; assets: GameAsset[]};
export type LoadProgress = {loadedBytes: number; totalBytes: number; completed: number; total: number};
export const resourceUrl = (url: string, base = document.baseURI) => { const resolved = new URL(url, base); resolved.hash = ''; return resolved.href; };
const downloaded = new Map<string, Promise<void>>();
const failedTransfers = new Set<string>();

/** No-SW/development fallback: shared requests, bounded transfer concurrency, retryable failures. */
export function downloadResource(url: string, expectedRevision?: string) {
  const address = resourceUrl(url), key = address + (expectedRevision ? '#' + expectedRevision : '');
  let task = downloaded.get(key);
  if (!task) {
    task = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(address, {cache: failedTransfers.has(key) ? 'reload' : 'force-cache', signal: controller.signal});
        if (!response.ok) throw new Error(`资源未能加载：${url}`);
        // Consume the body before reporting ready; fetch resolves at headers, not at end of transfer.
        const bytes = await response.arrayBuffer();
        if (expectedRevision && globalThis.crypto?.subtle) {
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const revision = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
          if (revision !== expectedRevision) throw new Error(`资源版本不一致：${url}`);
        }
        failedTransfers.delete(key);
      } finally { clearTimeout(timer); }
    })().catch(error => { downloaded.delete(key); failedTransfers.add(key); throw error; });
    downloaded.set(key, task);
  }
  return task;
}
export async function downloadResources(manifest: GameAssetManifest, progress: (state: LoadProgress) => void) {
  const assets = [...new Map(manifest.assets.map(asset => [resourceUrl(asset.url), asset])).values()];
  let cursor = 0;
  const state = {loadedBytes: 0, totalBytes: assets.reduce((sum, a) => sum + a.bytes, 0), completed: 0, total: assets.length};
  const failures: string[] = [];
  await Promise.all(Array.from({length: 6}, async () => {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      try { await downloadResource(asset.url, manifest.development ? undefined : asset.revision); state.loadedBytes += asset.bytes; }
      catch { failures.push(asset.url); }
      state.completed++; progress({...state});
    }
  }));
  if (failures.length) throw new Error(`未完成的资源：${failures.join(', ')}`);
}

export async function readAssetManifest(): Promise<GameAssetManifest> {
  const response = await fetch(resourceUrl('./game-assets.json'), {cache: 'no-cache', signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error('资源清单未能加载');
  const value = await response.json() as GameAssetManifest;
  if (!value || typeof value.version !== 'string' || !Array.isArray(value.assets) || !value.assets.length) throw new Error('资源清单不完整');
  for (const asset of value.assets) {
    const url = new URL(asset.url, document.baseURI);
    if (url.origin !== location.origin || !Number.isFinite(asset.bytes) || asset.bytes < 0 || !/^[a-f0-9]{64}$/.test(asset.revision)) throw new Error('资源清单无效');
  }
  return value;
}

async function activateCacheWorker() {
  const registration = await navigator.serviceWorker.register(resourceUrl('./game-cache.js'), {scope: './', updateViaCache: 'none'});
  // Some hosts resolve register() with the existing active worker before its update job has
  // installed the new version. Explicitly finish that check before sending a versioned manifest.
  if (registration.active && !registration.installing) await registration.update();
  const candidate = registration.installing ?? registration.waiting ?? registration.active;
  if (!candidate) throw new Error('资源缓存未能启动');
  if (candidate.state !== 'activated') await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('资源缓存启动超时')), 15_000);
    const changed = () => { if (candidate.state === 'activated') finish(); else if (candidate.state === 'redundant') finish(new Error('资源缓存已更新，请重试')); };
    const finish = (error?: Error) => { clearTimeout(timer); candidate.removeEventListener('statechange', changed); if (error) reject(error); else resolve(); };
    candidate.addEventListener('statechange', changed); changed();
  });
  if (!navigator.serviceWorker.controller) await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('资源缓存接管超时')), 8_000);
    const changed = () => { if (navigator.serviceWorker.controller) finish(); };
    const finish = (error?: Error) => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); if (error) reject(error); else resolve(); };
    navigator.serviceWorker.addEventListener('controllerchange', changed); changed();
  });
  return candidate;
}

export async function prepareResources(manifest: GameAssetManifest, progress: (state: LoadProgress) => void) {
  if (manifest.development || !('serviceWorker' in navigator) || !window.isSecureContext) return downloadResources(manifest, progress);
  let worker: ServiceWorker;
  // Hosts which forbid persistent workers still get the same gate and bounded HTTP prefetch.
  try { worker = await activateCacheWorker(); }
  catch {
    // Offline revisits can keep using the already active worker even when update() cannot reach the host.
    if (navigator.serviceWorker.controller) worker = navigator.serviceWorker.controller;
    else return downloadResources(manifest, progress);
  }
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => { clearTimeout(timer); channel.port1.close(); if (error) reject(error); else resolve(); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('资源加载无响应，请重试')), 75_000); };
    channel.port1.onmessage = event => {
      arm();
      if (event.data?.type === 'progress') progress(event.data);
      else if (event.data?.type === 'ready') finish();
      else if (event.data?.type === 'error') finish(new Error(event.data.message));
    };
    channel.port1.onmessageerror = () => finish(new Error('资源加载进度未能读取'));
    arm(); worker.postMessage({type: 'prepare', version: manifest.version}, [channel.port2]);
  });
}
