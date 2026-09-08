import { afterEach, expect, it, vi } from 'vitest';
import { downloadResource, downloadResources, readAssetManifest, resourceUrl } from './resources';
afterEach(() => vi.unstubAllGlobals());
const revision = 'a'.repeat(64);
it('normalizes URL identity and shares an in-flight transfer until its body is consumed', async () => {
  let finish!: () => void;
  const arrayBuffer = vi.fn(() => new Promise<void>(resolve => {finish = resolve;}));
  const fetcher = vi.fn(async () => ({ok: true, arrayBuffer})); vi.stubGlobal('fetch', fetcher);
  const a = downloadResource('./shared-a.webp'), b = downloadResource(resourceUrl('./shared-a.webp#frame'));
  expect(a).toBe(b);
  let ready = false; void a.then(() => {ready = true;});
  await Promise.resolve(); expect(ready).toBe(false); finish(); await a;
  await downloadResource('./shared-a.webp'); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('limits parallel transfers, retains successes and retries only failures', async () => {
  let active = 0, peak = 0, fail = true;
  const counts = new Map<string, number>();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    counts.set(url, (counts.get(url) ?? 0) + 1); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return {ok: !(fail && url.endsWith('/retry-3.png')), arrayBuffer: async () => new ArrayBuffer(1)};
  }));
  const manifest = {version: 'v1', development: true, assets: Array.from({length: 13}, (_, i) => ({url: `./retry-${i}.png`, bytes: 1, revision}))};
  await expect(downloadResources(manifest, () => {})).rejects.toThrow();
  fail = false; const progress = vi.fn(); await downloadResources(manifest, progress);
  expect(peak).toBeLessThanOrEqual(6);
  expect(counts.get(resourceUrl('./retry-3.png'))).toBe(2);
  expect(counts.get(resourceUrl('./retry-2.png'))).toBe(1);
  expect(progress.mock.lastCall?.[0]).toMatchObject({completed: 13, loadedBytes: 13});
});
it('rejects invalid manifest entries instead of releasing the game', async () => {
  vi.stubGlobal('fetch', async () => ({ok: true, json: async () => ({version:'v1',assets:[{url:'https://foreign.invalid/x',bytes:1,revision}]})}));
  await expect(readAssetManifest()).rejects.toThrow('资源清单无效');
});
it('resolves a deployment subdirectory without making assets origin-root relative', () => {
  expect(resourceUrl('./assets/image.webp', 'https://example.test/games/abyssa/title.html?save=test')).toBe('https://example.test/games/abyssa/assets/image.webp');
});
it('waits for an explicit worker update when register returns an older active version', async () => {
  vi.stubGlobal('isSecureContext', true);
  const oldPost = vi.fn();
  const newPost = vi.fn((_message, ports) => ports[0].reply({type:'ready'}));
  const registration = {
    active: {state:'activated', postMessage:oldPost},
    installing: null as null | {state:string;postMessage:typeof newPost},
    waiting: null,
    update: vi.fn(async () => { registration.installing = {state:'activated',postMessage:newPost}; }),
  };
  vi.stubGlobal('navigator',{serviceWorker:{register:vi.fn(async()=>registration),controller:registration.active}});
  vi.stubGlobal('MessageChannel',class {
    port1={onmessage:null as null | ((event:{data:unknown})=>void),onmessageerror:null,close:()=>{}};
    port2={reply:(data:unknown)=>this.port1.onmessage?.({data})};
  });
  const {prepareResources}=await import('./resources');
  await prepareResources({version:'new',development:false,assets:[{url:'./file.webp',bytes:1,revision}]},()=>{});
  expect(registration.update).toHaveBeenCalledTimes(1);
  expect(oldPost).not.toHaveBeenCalled();expect(newPost).toHaveBeenCalledTimes(1);
});
