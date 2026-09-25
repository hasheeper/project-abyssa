import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./resources', () => ({readAssetManifest: vi.fn(async () => ({version:'test'})), prepareResources: vi.fn(async () => {})}));
afterEach(() => {
  Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks();
});

it('shares critical fonts, selects visible glyphs, and never waits for the full inventory', async () => {
  let finish!: () => void;
  const load = vi.fn((_font: string, _text: string) => new Promise<void>(resolve => {finish=resolve;}));
  load.mockResolvedValueOnce();
  Object.defineProperty(document, 'fonts', {configurable:true, value:{load,ready:new Promise(() => {})}});
  const {prepareGame} = await import('./startup');
  const {readAssetManifest,prepareResources} = await import('./resources');
  const pending = prepareGame();
  expect(prepareGame()).toBe(pending);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load.mock.calls[1]).toEqual([expect.stringContaining('Noto Serif SC'),expect.stringContaining('继续游戏')]);
  finish(); await pending;
  expect(readAssetManifest).not.toHaveBeenCalled(); expect(prepareResources).not.toHaveBeenCalled();
});

it('retries critical font failures', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('font unavailable')).mockResolvedValue([]);
  Object.defineProperty(document,'fonts',{configurable:true,value:{load}});
  const {prepareGame} = await import('./startup');
  await expect(prepareGame()).rejects.toThrow('font unavailable'); await prepareGame();
  expect(load).toHaveBeenCalledTimes(4);
});

it('deduplicates background work and contains errors without poisoning a later retry', async () => {
  const {prepareResources,readAssetManifest} = await import('./resources');
  const warn = vi.spyOn(console,'warn').mockImplementation(() => {});
  vi.mocked(prepareResources).mockRejectedValueOnce(new Error('offline'));
  const {warmGameResources} = await import('./startup');
  const first = warmGameResources(); expect(warmGameResources()).toBe(first);
  await expect(first).resolves.toBeUndefined(); await warmGameResources(); await warmGameResources();
  expect(warn).toHaveBeenCalledTimes(1); expect(readAssetManifest).toHaveBeenCalledTimes(2);
  expect(prepareResources).toHaveBeenLastCalledWith({version:'test'},expect.any(Function),{background:true});
});

it('respects data-saving mode without eagerly downloading the game', async () => {
  vi.stubGlobal('navigator',{connection:{saveData:true}});
  const {warmGameResources} = await import('./startup');
  const {readAssetManifest} = await import('./resources');
  await warmGameResources(); expect(readAssetManifest).not.toHaveBeenCalled();
});
