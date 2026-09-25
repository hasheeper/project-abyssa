import { expect, it, vi } from 'vitest';
vi.mock('./TitlePage', () => ({TitlePage: () => null}));
vi.mock('../../shared/loading/images', () => ({loadImage: vi.fn(async () => ({}))}));
import { prepare } from './route';
import { loadImage } from '../../shared/loading/images';
import { TITLE_CG_FRAMES, TITLE_CG_RIGHT_OFFSET } from './titleCg';
it('only waits for the two initially visible CGs', async () => {
  await prepare();
  expect(vi.mocked(loadImage).mock.calls.map(call => call[0])).toEqual([
    TITLE_CG_FRAMES[0].src, TITLE_CG_FRAMES[TITLE_CG_RIGHT_OFFSET].src,
  ]);
});
