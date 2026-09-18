import { MANSION_WORLD_HEIGHT as H, MANSION_WORLD_WIDTH as W } from "./data";

/** Two seeded vector batches, repeated along their fall vector. At the loop
 * boundary every streak takes its neighbour's place: no reset flash or random
 * per-frame work. Overscan keeps both ends covered while translating. */
export function mansionRainPaths(seed:number) {
  let state=(seed^0x71ab0c)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return [
    {count:64,fall:320,wind:-44,length:25,duration:2.5,width:1.3,opacity:.22},
    {count:30,fall:420,wind:-58,length:56,duration:1.45,width:1.8,opacity:.38}
  ].map(layer=>{
    const strokes:string[]=[];
    for(let i=0;i<layer.count;i++) {
      const x=-160+random()*(W+320),y=random()*layer.fall;
      const length=layer.length*(.65+random()*.7);
      for(let row=-2;row<=Math.ceil(H/layer.fall)+1;row++) {
        const sx=x+row*layer.wind,sy=y+row*layer.fall;
        strokes.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}l${(length*layer.wind/layer.fall).toFixed(1)} ${length.toFixed(1)}`);
      }
    }
    return {...layer,d:strokes.join("")};
  });
}
