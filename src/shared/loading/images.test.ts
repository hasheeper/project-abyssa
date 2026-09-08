import { afterEach, expect, it, vi } from 'vitest';
import { loadImage } from './images';
afterEach(() => vi.useRealTimers());
it('decodes a ready render element once, shared with subsequent preload callers', async () => {
  const image = document.createElement('img'); image.src = './decode-once.png';
  const decode = vi.fn(async () => {}); image.decode = decode;
  const first = loadImage(image.src, image, true);
  expect(loadImage('./decode-once.png')).toBe(first);
  expect(await first).toBe(image); expect(decode).toHaveBeenCalledTimes(1);
});
it('failed decoding does not permanently poison the resource cache', async () => {
  const image = document.createElement('img'); image.src = './decode-retry.png';
  image.decode = vi.fn(async () => {throw new Error('truncated');});
  await expect(loadImage(image.src, image, true)).rejects.toThrow('解码失败');
  image.decode = vi.fn(async () => {});
  expect(await loadImage(image.src, image, true)).toBe(image);
});
it('drops old decoded references when the pixel budget is exceeded', async () => {
  const make = (src: string) => {
    const image = document.createElement('img'); image.src = src; image.decode = vi.fn(async () => {});
    Object.defineProperties(image, {naturalWidth:{value:4000},naturalHeight:{value:4000}}); return image;
  };
  const first = make('./large-first.png'); await loadImage(first.src, first, true);
  for (let i=0;i<3;i++) { const image=make(`./large-${i}.png`); await loadImage(image.src,image,true); }
  await loadImage(first.src,first,true);
  expect(first.decode).toHaveBeenCalledTimes(2);
});
