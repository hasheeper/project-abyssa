import type { TutorialRect, TutorialSide } from "./types";

export const intersects = (a: TutorialRect, b: TutorialRect, gap = 0) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

export function intersectRect(a: TutorialRect, b: TutorialRect): TutorialRect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? {x, y, width: right - x, height: bottom - y} : null;
}

export function expandRect(r: TutorialRect, padding = 6): TutorialRect {
  return {x: r.x-padding, y:r.y-padding, width:r.width+padding*2, height:r.height+padding*2};
}

/** CSS-pixel geometry. Never apply devicePixelRatio or the stage scale a second time. */
export function placeTutorialCard(bounds: TutorialRect, size: {width: number; height: number}, targets: readonly TutorialRect[],
  protectedRects: readonly TutorialRect[] = [], sides: readonly TutorialSide[] = ["right", "left", "top", "bottom"]): TutorialRect | null {
  if (!targets.length) return null;
  const margin = 14, gap = 16;
  const minX=bounds.x+margin, minY=bounds.y+margin;
  const maxX=bounds.x+bounds.width-margin-size.width, maxY=bounds.y+bounds.height-margin-size.height;
  if (maxX<minX || maxY<minY) return null;
  const t=targets[0], cx=t.x+t.width/2, cy=t.y+t.height/2;
  const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
  const x=clamp(cx-size.width/2,minX,maxX), y=clamp(cy-size.height/2,minY,maxY);
  const preferred: Record<TutorialSide,{x:number;y:number}> = {
    right:{x:t.x+t.width+gap,y}, left:{x:t.x-gap-size.width,y}, top:{x,y:t.y-gap-size.height}, bottom:{x,y:t.y+t.height+gap},
  };
  const obstacles=[...targets,...protectedRects];
  const candidates=sides.map(side=>preferred[side]);
  // Also examine the free rectangles between controls, not just the four viewport corners.
  const xs=[minX,maxX,x,...obstacles.flatMap(o=>[o.x-size.width-gap,o.x+o.width+gap])];
  const ys=[minY,maxY,y,...obstacles.flatMap(o=>[o.y-size.height-gap,o.y+o.height+gap])];
  candidates.push(...xs.flatMap(x=>ys.map(y=>({x,y}))));
  let best: TutorialRect | null=null, score=Infinity;
  candidates.forEach((point,index)=>{
    const r={...point,...size};
    if(r.x<minX || r.y<minY || r.x>maxX || r.y>maxY || obstacles.some(o=>intersects(r,o,8))) return;
    const dx=Math.max(t.x-r.x-r.width,r.x-t.x-t.width,0), dy=Math.max(t.y-r.y-r.height,r.y-t.y-t.height,0);
    const distance=Math.hypot(dx,dy)+(index<sides.length? index*3:24);
    if(distance<score) {best=r;score=distance;}
  });
  return best;
}

export function visibleAnchorRect(node: HTMLElement, bounds: TutorialRect): TutorialRect | null {
  if (!node.isConnected || node.closest('[hidden],[inert],[aria-hidden="true"]')) return null;
  const raw=node.getBoundingClientRect();
  if(raw.width<=0 || raw.height<=0) return null;
  const rect={x:raw.left,y:raw.top,width:raw.width,height:raw.height};
  let visible=intersectRect(rect,bounds);
  for(let parent: HTMLElement | null=node; parent && visible; parent=parent.parentElement) {
    const style=getComputedStyle(parent);
    if(style.display==="none" || style.visibility==="hidden" || style.opacity!=="" && Number(style.opacity)===0) return null;
    if(parent===node) continue;
    const clipX=/(hidden|clip|auto|scroll)/.test(style.overflowX), clipY=/(hidden|clip|auto|scroll)/.test(style.overflowY);
    if(clipX || clipY) {
      const p=parent.getBoundingClientRect();
      visible=intersectRect(visible,{x:clipX?p.left:bounds.x,y:clipY?p.top:bounds.y,width:clipX?p.width:bounds.width,height:clipY?p.height:bounds.height});
    }
  }
  // A clipped control is not a valid click target; wait until it really becomes visible.
  return visible && visible.width>=rect.width-1 && visible.height>=rect.height-1 ? rect : null;
}
