import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../apps/menu/MenuPage', () => ({MenuPage:()=>null}));
vi.mock('../apps/character-status/App', () => ({App:()=>null}));
vi.mock('../apps/shop/ShopPage', () => ({ShopPage:()=>null}));
vi.mock('../shared/loading/images', () => ({prepareImages:vi.fn(async()=>{})}));
import { prepareImages } from '../shared/loading/images';
beforeEach(()=>vi.clearAllMocks());
it.each([
  ['menu',()=>import('../apps/menu/route'),['manor-night-gallery.jpg']],
  ['character-status',()=>import('../apps/character-status/route'),['manor-night-gallery.jpg']],
  ['shop',()=>import('../apps/shop/route'),['shop-bg3.jpg','shop-bg2.png','counter-foreground-front.png','wood-grain-v1.webp']],
] as const)('prepares %s CSS backgrounds without relying on the whole-game warmup',async(_page,load,files)=>{
  await (await load()).prepare();
  expect(prepareImages).toHaveBeenCalledTimes(1);
  expect(vi.mocked(prepareImages).mock.calls[0][0].map(url=>url.split('/').at(-1))).toEqual(expect.arrayContaining([...files]));
});
