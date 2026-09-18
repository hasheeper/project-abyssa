import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MANSION_NIGHT_STARS, paintMansionNightSky } from "./mansion-night-sky";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({
    createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:vi.fn()
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

function skyContext() {
  const gradient = () => ({addColorStop:vi.fn()});
  return {
    save:vi.fn(), restore:vi.fn(), createLinearGradient:vi.fn(gradient), createRadialGradient:vi.fn(gradient),
    fillRect:vi.fn(), beginPath:vi.fn(), arc:vi.fn(), fill:vi.fn(), moveTo:vi.fn(), bezierCurveTo:vi.fn(), closePath:vi.fn(), drawImage:vi.fn()
  };
}

it("draws stars and detached cloud pixels, with no moon, halo or horizontal Bézier ribbons", () => {
  const ctx = skyContext();
  paintMansionNightSky(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  expect(ctx.arc).toHaveBeenCalledTimes(156);
  expect(ctx.arc.mock.calls.every(call=>call[2]<=2.4)).toBe(true);
  expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
  expect(ctx.drawImage).toHaveBeenCalledOnce();
  const surface=ctx.drawImage.mock.calls[0][0] as HTMLCanvasElement;
  expect(surface.isConnected).toBe(false);
  expect(surface.width).toBe(0);
  expect(surface.height).toBe(0);
});

it("reuses the same irregular star field on every visit without animated sky surfaces", () => {
  const first=skyContext(), second=skyContext();
  paintMansionNightSky(first as unknown as CanvasRenderingContext2D);
  paintMansionNightSky(second as unknown as CanvasRenderingContext2D);
  expect(first.arc.mock.calls).toEqual(second.arc.mock.calls);
  expect(MANSION_NIGHT_STARS).toHaveLength(156);
  expect(new Set(MANSION_NIGHT_STARS.map(star=>star.x)).size).toBe(156);
  expect(MANSION_NIGHT_STARS.every(star=>star.radius<=2.4 && star.opacity>0 && star.opacity<1)).toBe(true);
});
