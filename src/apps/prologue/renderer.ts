import { STAGE_CANVAS_WIDTH as W, STAGE_CANVAS_HEIGHT as H } from "../../shared/stage";
import { CONTACT_IMPACT_MS, CUE_DURATION_MS, type PrologueShot } from "./script";

export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sine = (t: number) => (1 - Math.cos(Math.PI * clamp(t))) / 2;

/** Bounded working set: the current CG, the decoded next CG and one outgoing frame. */
const images = new Map<string, Promise<HTMLImageElement>>();
export function loadCg(url: string): Promise<HTMLImageElement> {
  let promise = images.get(url);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.decoding = "async";
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error("CG 暂时未能载入")); image.src = url;
    }).catch(error => { images.delete(url); throw error; });
    images.set(url, promise);
  }
  return promise;
}
export function retainCgs(urls: (string | undefined)[]) {
  for (const key of images.keys()) if (!urls.includes(key)) images.delete(key);
}

const contactImpactKeys = [
  { time: 0, x: -7, y: 5, angle: -.12, zoom: 0 },
  { time: 100, x: 11, y: -7, angle: .20, zoom: .014 },
  { time: 220, x: -4, y: 2, angle: -.07, zoom: .005 },
  { time: 360, x: 1, y: -.5, angle: .015, zoom: .001 },
  { time: CONTACT_IMPACT_MS, x: 0, y: 0, angle: 0, zoom: 0 },
] as const;
const settledImpact = { x: 0, y: 0, angle: 0, zoom: 0 };
/** One authored contact and diminishing recoil, never a looping random shake. */
export function contactImpactAt(time: number) {
  if (time >= CONTACT_IMPACT_MS) return settledImpact;
  const end = contactImpactKeys.findIndex(key => key.time > Math.max(0, time));
  const from = contactImpactKeys[end - 1], to = contactImpactKeys[end];
  const t = sine((time - from.time) / (to.time - from.time));
  return { x: mix(from.x, to.x, t), y: mix(from.y, to.y, t), angle: mix(from.angle, to.angle, t), zoom: mix(from.zoom, to.zoom, t) };
}

/** UV crop is derived from the source, not guessed CSS offsets. Rotation includes safe edges. */
export function cameraAt(shot: PrologueShot, time: number, width: number, height: number, reduced = false) {
  const camera = shot.camera;
  const from = camera.kind === "still" ? camera.frame : camera.from;
  const to = camera.kind === "still" ? camera.frame : camera.to;
  const t = camera.kind === "still" ? 0 : reduced ? 1 : camera.easing === "retreat"
    ? .87 * (1 - 2 ** (-8 * clamp(time / 1200))) / (1 - 2 ** -8) + .13 * sine((time - 1200) / (camera.duration - 1200))
    : sine(time / camera.duration);
  const impact = shot.entrance === "contact" && !reduced ? contactImpactAt(time) : settledImpact;
  const scale = mix(from.scale, to.scale, t) * (1 + impact.zoom);
  const angle = (mix(from.angle ?? 0, to.angle ?? 0, t) + impact.angle) * Math.PI / 180;
  const fit = Math.max(W / width, H / height);
  const sx = W / (width * fit * scale), sy = H / (height * fit * scale);
  const safeX = (Math.abs(Math.cos(angle)) * sx + Math.abs(Math.sin(angle)) * sy * height / width) / 2;
  const safeY = (Math.abs(Math.sin(angle)) * sx * width / height + Math.abs(Math.cos(angle)) * sy) / 2;
  // Handheld movement enters and settles with the shot, so a long reading hold
  // stays calm and the final morning frame joins the logo without a position jump.
  const hand = camera.kind === "move" && !reduced
    ? (camera.handheld ?? 0) * sine(time / 800) * (1 - sine((time - camera.duration + 1200) / 1200)) : 0;
  const dx = (hand * (Math.sin(time / 1350) + .33 * Math.sin(time / 487)) + impact.x) / W;
  const dy = (hand * (Math.cos(time / 1670) + .30 * Math.sin(time / 653)) + impact.y) / H;
  return { sx, sy, angle, x: clamp(mix(from.x, to.x, t) + dx, safeX, 1 - safeX), y: clamp(mix(from.y, to.y, t) + dy, safeY, 1 - safeY) };
}

/** Static CGs are painted once; one-shot light changes settle on their final frame. */
export function cgAnimationDuration(shot: PrologueShot, reduced: boolean) {
  const camera = shot.camera.kind === "move" && !reduced ? shot.camera.duration : 0;
  const continuous = ["gold", "hero", "tyrant", "fire", "rift", "kitchen"].includes(shot.effect);
  const light = shot.effect === "sword" ? 4000 : shot.effect === "embrace" ? 5500 : shot.effect === "sea" ? 5000 : shot.effect === "title" ? 1500 : 0;
  const entrance = shot.entrance === "contact" && !reduced ? CONTACT_IMPACT_MS : 0;
  return continuous && !reduced ? Infinity : Math.max(camera, light, entrance);
}

/** Camera time and a line-triggered light cue are independent. Reading slowly
 * must not consume the sword/embrace effect before its sentence appears. */
export function cgFrameTimes(shot: PrologueShot, time: number, reduced: boolean, cueTime: number | null) {
  const cue = shot.beats.find(beat => beat.cue)?.cue;
  if (!cue) {
    const sample = Math.min(time, cgAnimationDuration(shot, reduced));
    return { cameraTime: sample, effectTime: sample };
  }
  const cameraDuration = shot.camera.kind === "move" && !reduced ? shot.camera.duration : 0;
  return {
    cameraTime: Math.min(time, cameraDuration),
    effectTime: cueTime === null ? 0 : clamp(time - cueTime, 0, CUE_DURATION_MS[cue]),
  };
}

/** Backing pixels follow the displayed Stage and DPR, independent of FX quality. */
export function cgBackingSize(cssWidth: number, pixelRatio: number) {
  const width = Math.max(16, Math.min(2560, Math.ceil(cssWidth * Math.max(1, pixelRatio) / 16) * 16));
  return { width, height: width * H / W };
}

export const hasParticles = (shot: PrologueShot) => ["rain", "gold", "hero", "fire", "rift", "embrace", "kitchen", "morning"].includes(shot.effect);

const vertex = `attribute vec2 position; varying vec2 screen;
void main(){ screen=vec2((position.x+1.)*.5,(1.-position.y)*.5); gl_Position=vec4(position,0.,1.); }`;
const fragment = `precision highp float;
varying vec2 screen; uniform sampler2D picture;
uniform vec4 camera; uniform float angle; uniform float aspect; uniform float seconds;
uniform float act; uniform float effect; uniform float reduced;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float smoothNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(noise(i),noise(i+vec2(1.,0.)),f.x),mix(noise(i+vec2(0.,1.)),noise(i+vec2(1.,1.)),f.x),f.y);}
float glow(vec2 uv,vec2 center,vec2 size){vec2 d=(uv-center)/size;return exp(-dot(d,d)*2.);}
void main(){
 vec2 p=(screen-.5)*camera.zw; p.x*=aspect;
 p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p; p.x/=aspect;
 vec2 uv=camera.xy+p;
 vec3 raw=texture2D(picture,uv).rgb;
 float l=dot(raw,vec3(.2126,.7152,.0722));
 float sat=act==2.?.60:act==3.?.30:act==4.?1.04:.82;
 float warm=0.;
 if(effect==11.){
   float progress=clamp((seconds-1.)/4.5,0.,1.); progress=1.-pow(1.-progress,3.);
   vec2 d=(uv-vec2(.405,.48))*vec2(aspect,1.);
   float edge=smoothNoise(uv*13.+vec2(seconds*.025,0.))*.065+smoothNoise(uv*31.)*.022;
   warm=(1.-smoothstep(max(0.,progress*.66-.08),progress*.66+.08,length(d)+edge)) * smoothstep(0.,.5,seconds-1.);
   sat=mix(.30,1.,warm);
 }
 vec3 color=mix(vec3(l),raw,sat);
 if(act==2.) color*=vec3(.94,.98,1.035);
 if(act==3.) color*=mix(vec3(.955,.985,1.015),vec3(1.025,1.,.98),warm);
 if(act==4.) color*=vec3(1.02,1.005,.975);
 float live=1.-reduced;
 if(effect==0. || effect==1.){
   float beam=glow(uv,vec2(.50,.19),vec2(.12,.75));
   color+=vec3(.055,.044,.025)*beam*(.75+.08*sin(seconds*1.12)*live);
 }
 if(effect==1.){
   float glint=exp(-pow((seconds-4.2)/.27,2.))*live;
   color+=vec3(.12,.10,.06)*glow(uv,vec2(.50,.09),vec2(.07,.03))*glint;
 }
 if(effect==2.){
   float red=smoothstep(.05,.27,raw.r-max(raw.b,raw.g));
   float eyes=sin(seconds*(1.8+smoothNoise(floor(uv*14.))*1.9)+smoothNoise(floor(uv*19.))*11.);
   color.r+=red*(.025+.035*eyes)*live;
   color+=vec3(.036,.007,0.)*glow(uv,vec2(.5,.85),vec2(.60,.24))*(.8+.2*sin(seconds*3.1)*live);
 }
 if(effect==5.){
   float fire=(.7+.12*sin(seconds*6.7)+.10*sin(seconds*10.3))*live+.3*reduced;
   color+=vec3(.12,.058,.010)*glow(uv,vec2(.49,.63),vec2(.34,.29))*fire;
 }
 if(effect==7.) color+=vec3(.042,.002,.006)*glow(uv,vec2(.5,.2),vec2(.8,.13))*(.7+.3*sin(seconds*2.1)*live);
 if(effect==10.){
   float blade=glow(uv,vec2(.60,.65),vec2(.10,.33));
   color=mix(color,vec3(l)*.94,blade*smoothstep(1.5,4.,seconds)*.55);
 }
 if(effect==11.) color+=vec3(.045,.026,.008)*glow(uv,vec2(.405,.48),vec2(.30,.35))*warm;
 if(effect==12.) color+=vec3(.025,.018,.007)*glow(uv,vec2(.5,.46),vec2(.8,.025))*clamp(seconds/5.,0.,1.);
 if(effect==14.){
   float steam=smoothNoise(vec2(uv.x*10.,uv.y*8.+seconds*.22))*smoothNoise(vec2(uv.x*19.,uv.y*13.+seconds*.30));
   color+=vec3(.065)*steam*glow(uv,vec2(.80,.40),vec2(.15,.26))*live;
 }
 // A shared print-like tonal curve, applied once to the CG before captions/logo.
 // Roll off hot highlights while preserving the act's cold/warm color direction.
 float density=dot(color,vec3(.2126,.7152,.0722));
 color*=1.-.09*smoothstep(.55,1.15,density);
 color=mix(vec3(.016,.015,.014),color,.96);
 float vignette=act==1.?.18:act==2.?.25:act==3.?.18:.08;
 float distance=length((screen-.5)*vec2(1.,.8));
 color*=1.-vignette*smoothstep(.25,.67,distance);
 if(effect==17.){
   float t=smoothstep(0.,1.5,seconds);
   color*=mix(1.,.51,t);
 }
 gl_FragColor=vec4(color,1.);
}`;
const effects: PrologueShot["effect"][] = ["gold", "hero", "tyrant", "glass", "rain", "fire", "chess", "rift", "vortex", "black", "sword", "embrace", "sea", "black", "kitchen", "tentacle", "morning", "title"];

export type CgRenderer = { render(time: number, effectTime?: number): void; dispose(): void };
export function createCgRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, shot: PrologueShot, reduced: boolean): CgRenderer {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return createFlatRenderer(canvas, image, shot, reduced);
  const shader = (type: number, code: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(info ?? "CG shader compilation failed"); }
    return s;
  };
  const program = gl.createProgram()!, vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("CG shader link failed");
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  const location = (key: string) => gl.getUniformLocation(program, key);
  const camera = location("camera"), angle = location("angle"), seconds = location("seconds");
  gl.uniform1i(location("picture"), 0); gl.uniform1f(location("aspect"), image.width / image.height);
  gl.uniform1f(location("effect"), effects.indexOf(shot.effect)); gl.uniform1f(location("act"), shot.act); gl.uniform1f(location("reduced"), reduced ? 1 : 0);
  return {
    render(time, effectTime = time) {
      const c = cameraAt(shot, time, image.width, image.height, reduced);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform4f(camera, c.x, c.y, c.sx, c.sy);
      gl.uniform1f(angle, c.angle); gl.uniform1f(seconds, effectTime / 1000); gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}

/** Hardware-disabled browsers keep the authored framing and local embrace restoration. */
function createFlatRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, shot: PrologueShot, reduced: boolean): CgRenderer {
  const ctx = canvas.getContext("2d")!;
  const colorLayer=document.createElement("canvas");colorLayer.width=canvas.width;colorLayer.height=canvas.height;
  const colorContext=colorLayer.getContext("2d")!;
  return { render(time, effectTime = time) {
    if(colorLayer.width!==canvas.width || colorLayer.height!==canvas.height){colorLayer.width=canvas.width;colorLayer.height=canvas.height;}
    const c = cameraAt(shot, time, image.width, image.height, reduced);
    const draw = (target:CanvasRenderingContext2D) => {
      const scale=canvas.width/(image.width*c.sx);target.save();target.translate(canvas.width/2,canvas.height/2);target.rotate(c.angle);
      target.drawImage(image,-c.x*image.width*scale,-c.y*image.height*scale,image.width*scale,image.height*scale);target.restore();
    };
    ctx.save(); ctx.filter = `saturate(${shot.act === 1 ? .82 : shot.act === 2 ? .6 : shot.act === 3 ? .3 : 1}) contrast(.96) brightness(.97)`; draw(ctx); ctx.restore();
    if (shot.effect === "embrace" && effectTime > 1000) {
      const x = ((.405-c.x)/c.sx+.5)*canvas.width, y = ((.48-c.y)/c.sy+.5)*canvas.height;
      const radius=(1-(1-clamp((effectTime-1000)/4500))**3)*canvas.width*.62;
      colorContext.clearRect(0,0,canvas.width,canvas.height);draw(colorContext);colorContext.save();
      const mask=colorContext.createRadialGradient(x,y,Math.max(0,radius-90),x,y,radius+90);mask.addColorStop(0,"#fff");mask.addColorStop(1,"#fff0");
      colorContext.globalCompositeOperation="destination-in";colorContext.fillStyle=mask;colorContext.fillRect(0,0,canvas.width,canvas.height);colorContext.restore();
      ctx.drawImage(colorLayer,0,0);
    }
    if (shot.effect === "title") { ctx.fillStyle = `rgba(0,0,0,${clamp(effectTime/1500)*.49})`; ctx.fillRect(0,0,canvas.width,canvas.height); }
  }, dispose() {} };
}

/** Small seeded particles; no evolving arrays or allocations inside a frame. */
export function createParticles(canvas: HTMLCanvasElement, shot: PrologueShot) {
  const ctx = canvas.getContext("2d")!;
  const seed = (n: number) => { const f = Math.sin(n * 127.1 + 31.7) * 43758.5453; return f - Math.floor(f); };
  return (time: number, quality: number) => {
    const t = time / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(canvas.width / W, canvas.height / H);
    if (shot.effect === "rain") {
      for (let i = 0; i < 130 * quality; i++) {
        const front = i % 3 === 0, y = (seed(i+1)*H+t*(front?900:600))%(H+80)-40, x = (seed(i+800)*W-t*60+W*30)%(W+50);
        ctx.strokeStyle = `rgba(195,212,220,${front?.19:.09})`; ctx.lineWidth = front ? 1.3 : .7;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-4,y+(front?33:17)); ctx.stroke();
      }
    } else if (["gold","hero","fire","rift","embrace","kitchen","morning"].includes(shot.effect)) {
      const ember=shot.effect==="fire", ash=shot.effect==="rift" || shot.effect==="embrace", count=ember?12:ash?65:30;
      for(let i=0;i<count*quality;i++) {
        const speed=ember?32:ash?28:9, life=(seed(i+19)*11+t) % 11, alpha=Math.sin(life/11*Math.PI)*(ember?.5:ash?.25:.30);
        const x=ember? W*(.49+(seed(i+70)-.5)*.08)+Math.sin(t+i)*11:seed(i+1)*W+Math.sin(t*.5+i)*13;
        const y=ember?H*.69-life*speed:(seed(i+290)*H-t*speed+H*40)%H;
        if(shot.effect==="embrace" && time<2000) continue;
        ctx.fillStyle = ember?`rgba(231,150,77,${alpha})`:ash?`rgba(207,210,203,${alpha})`:`rgba(237,213,159,${alpha})`;
        ctx.beginPath(); ctx.ellipse(x,y,ash?1.8:1.1,ash?3.4:1.1,Math.sin(t+i),0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  };
}
