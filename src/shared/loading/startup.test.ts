import { expect, it, vi } from 'vitest';
vi.mock('./resources', () => ({readAssetManifest: vi.fn(async () => ({})), prepareResources: vi.fn(async () => {})}));
import { prepareResources, readAssetManifest } from './resources';
import { prepareGame } from './startup';
it('shares one document preparation and permits retry after failure', async () => {
  const progress = vi.fn();
  vi.mocked(prepareResources).mockRejectedValueOnce(new Error('offline'));
  await expect(prepareGame(progress)).rejects.toThrow('offline');
  let ready!: () => void;
  vi.mocked(prepareResources).mockImplementationOnce(() => new Promise(resolve => {ready=resolve;}));
  const pending = prepareGame(progress);
  expect(prepareGame(progress)).toBe(pending);
  await Promise.resolve(); ready(); await pending;
  await prepareGame(progress);
  expect(readAssetManifest).toHaveBeenCalledTimes(2);
  expect(prepareResources).toHaveBeenCalledTimes(2);
});
