import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { STAGE_CANVAS_WIDTH as W, STAGE_CANVAS_HEIGHT as H } from "../../shared/stage";
import type { PrologueShot } from "./script";
import { cameraAt, cgFrameTimes, cgBackingSize, createCgRenderer, createParticles, hasParticles, loadCg, type CgRenderer } from "./renderer";

export type SceneClock = { time: number; cueTime: number | null; paused: boolean; ready: boolean };
export type CanvasHandle = { capture(): HTMLCanvasElement | null };
export const PrologueCanvas = forwardRef<CanvasHandle, { shot: PrologueShot; clock: SceneClock; reduced: boolean; onReady(): void; onError(): void }>(function PrologueCanvas({shot, clock, reduced, onReady, onError}, ref) {
  const base = useRef<HTMLCanvasElement>(null), fx = useRef<HTMLCanvasElement>(null), engine = useRef<CgRenderer | null>(null);
  const callbacks = useRef({onReady,onError}); callbacks.current = {onReady,onError};
  const [fallback, setFallback] = useState(false);
  const fallbackImage = useRef<HTMLImageElement | null>(null);
  useImperativeHandle(ref, () => ({ capture() {
    if (!clock.ready) return null;
    const capture = document.createElement("canvas");
    capture.width = base.current?.width || W; capture.height = base.current?.height || H;
    const ctx = capture.getContext("2d")!;
    if (shot.effect === "black") { ctx.fillStyle = "#000"; ctx.fillRect(0,0,capture.width,capture.height); return capture; }
    // Re-render before copying; keep the display resolution through the transition.
    if (engine.current) {
      const sample = cgFrameTimes(shot,clock.time,reduced,clock.cueTime);
      engine.current.render(sample.cameraTime,sample.effectTime);
      ctx.drawImage(base.current!,0,0,capture.width,capture.height);
    } else if (fallbackImage.current) {
      const im = fallbackImage.current, c = cameraAt(shot,Infinity,im.width,im.height,true);
      const scale = capture.width/(im.width*c.sx);
      ctx.save();ctx.translate(capture.width/2,capture.height/2);ctx.rotate(c.angle);
      ctx.drawImage(im,-c.x*im.width*scale,-c.y*im.height*scale,im.width*scale,im.height*scale);ctx.restore();
    }
    if (fx.current) ctx.drawImage(fx.current,0,0,capture.width,capture.height);
    return capture;
  }}), [clock, shot, reduced]);
  useEffect(() => {
    let disposed = false, raf = 0, resizeRaf = 0, last = 0, lastDraw = -Infinity, lastSample = -1, lastEffect = -1;
    let longFrames = 0, totalFrames = 0, quality = 1, forcePaint = true;
    const canvas = base.current!, particles = fx.current!;
    const particlesActive = !reduced && hasParticles(shot);
    function resize() {
      const size = cgBackingSize(canvas.getBoundingClientRect().width,window.devicePixelRatio);
      if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width; canvas.height = size.height; forcePaint = true;
      }
      // Soft particles have their own smaller surface. Slow devices never reduce CG pixels.
      const fxWidth = Math.min(size.width,quality < 1 ? 960 : 1280);
      if (particles.width !== fxWidth) { particles.width = fxWidth; particles.height = fxWidth*H/W; }
    }
    const requestResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); };
    resize();
    const observer = new ResizeObserver(requestResize);
    observer.observe(canvas.closest(".abyssa-stage") ?? canvas);
    window.addEventListener("resize",requestResize);
    const renderParticles = createParticles(particles,shot);
    const lost = (e:Event) => { e.preventDefault(); engine.current = null; setFallback(true); };
    canvas.addEventListener("webglcontextlost",lost);
    async function start() {
      try {
        if (shot.image) {
          const image = await loadCg(shot.image); if (disposed) return;
          fallbackImage.current = image;
          try { engine.current = createCgRenderer(canvas,image,shot,reduced); }
          catch { setFallback(true); }
        }
        if (disposed) return;
        engine.current?.render(0);
        clock.ready = true; callbacks.current.onReady();
        function tick(now:number) {
          if (disposed) return;
          const delta = last ? now-last : 0; last = now;
          const running = !document.hidden && !clock.paused;
          if (running) {
            clock.time += delta < 200 ? delta : 0;
            if (!reduced && totalFrames < 120 && delta > 0 && delta < 200) {
              totalFrames++;
              if (delta > 24) longFrames++;
              if (totalFrames === 120 && longFrames > 25) { quality = .5; resize(); }
            }
          }
          const sample = cgFrameTimes(shot,clock.time,reduced,clock.cueTime);
          const cameraMoving = !reduced && shot.camera.kind === "move" && clock.time < shot.camera.duration;
          const interval = reduced ? 1000/15 : quality < 1 ? 1000/24 : cameraMoving ? 1000/60 : 1000/30;
          if (forcePaint || (running && (sample.cameraTime !== lastSample || sample.effectTime !== lastEffect) && clock.time-lastDraw >= interval-.5)) {
            engine.current?.render(sample.cameraTime,sample.effectTime);
            lastDraw = clock.time; lastSample = sample.cameraTime; lastEffect = sample.effectTime; forcePaint = false;
          }
          if (running && particlesActive) renderParticles(shot.effect==="embrace" ? (clock.cueTime===null ? 0 : clock.time-clock.cueTime) : clock.time,quality);
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
      } catch { if (!disposed) callbacks.current.onError(); }
    }
    void start();
    return () => {
      disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(resizeRaf);
      observer.disconnect(); window.removeEventListener("resize",requestResize);
      canvas.removeEventListener("webglcontextlost",lost); engine.current?.dispose(); engine.current = null;
    };
  }, [shot, clock, reduced]);
  const image = fallbackImage.current;
  const c = cameraAt(shot,Infinity,image?.width ?? 1216,image?.height ?? 832,true);
  return <div className="prologue-picture" data-effect={shot.effect}>
    {fallback && shot.image && <img className="prologue-fallback" src={shot.image} alt="" style={{
      left:W/2,top:H/2,width:W/c.sx,height:H/c.sy,
      transformOrigin:`${c.x*100}% ${c.y*100}%`,transform:`translate(${-c.x*100}%,${-c.y*100}%) rotate(${c.angle}rad)`,
    }}/>}
    <canvas ref={base} aria-hidden="true" style={fallback?{visibility:"hidden"}:undefined}/>
    <canvas ref={fx} aria-hidden="true"/>
  </div>;
});
