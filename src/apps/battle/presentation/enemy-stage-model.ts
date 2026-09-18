import type { BattleSurfaceEnemy } from "./battle-surface-model";

export type EnemyArtBounds = { original: readonly [number, number]; bounds: readonly [number, number, number, number] };
/** Alpha bounds of the shipped art. The original PNGs and gameplay IDs stay intact. */
export const ENEMY_ART_BOUNDS: Record<string, EnemyArtBounds> = {
  "enemy.intro.tide-slime": {original:[1376,768],bounds:[123,130,1283,706]},
  "enemy.intro.lookout": {original:[1376,768],bounds:[234,39,1187,749]},
  "enemy.intro.crossbowman": {original:[1376,768],bounds:[100,61,1201,755]},
  "enemy.intro.hauler": {original:[2752,1536],bounds:[536,47,2044,1499]},
  "enemy.intro.reef-hook-chief": {original:[1376,768],bounds:[404,14,1014,749]},
  "old-manor.clockwork-beast": {original:[1408,768],bounds:[53,0,1309,754]},
  "old-manor.waiting-guest": {original:[1376,768],bounds:[419,0,978,728]},
  "old-manor.platter-bearer": {original:[1376,768],bounds:[244,0,1087,752]},
  "old-manor.mending-maid": {original:[1376,768],bounds:[421,0,859,760]},
  "old-manor.curtain-butler": {original:[1376,768],bounds:[173,0,1150,736]},
  "old-manor.puppet-heiress": {original:[1216,832],bounds:[0,0,1216,832]},
  "memory.marietta": {original:[1856,1280],bounds:[0,2,1856,1280]},
  sentinel: {original:[813,813],bounds:[99,46,697,737]},
  amalgam: {original:[768,768],bounds:[23,96,737,727]},
  choir: {original:[1376,768],bounds:[24,17,1355,709]},
};

export const ENEMY_HEALTH_POINTS_PER_LAYER = 8;

export function enemyHealthLayers(hp: number, maxHp: number) {
  const current = Math.max(0, Math.min(hp, maxHp));
  const capacity = ENEMY_HEALTH_POINTS_PER_LAYER;
  const layer = Math.ceil(current / capacity);
  const points = current ? (current - 1) % capacity + 1 : 0;
  return {layer, points, number: layer > 0 && layer <= 12 ? String.fromCharCode(0x215f + layer) : String(layer),
    showLayerNumber: maxHp > capacity * 4,
    pearls: Array.from({length: Math.min(capacity, maxHp)}, (_, index) => ({
      layer: Math.min(4, index < points ? layer : Math.max(0, layer - 1)),
      buried: layer > 4 && index >= points,
      boundary: layer > 1 && index === points - 1 && points < Math.min(capacity, maxHp),
    })),
  };
}

/** Keep an encounter's art/depth envelope by identity. Display order is packed
 * separately, so removing a neighbour never changes a survivor's size or depth. */
export function reconcileEnemySeats(previous: readonly BattleSurfaceEnemy[], next: readonly BattleSurfaceEnemy[]) {
  const live = new Map(next.map(enemy => [enemy.id, enemy]));
  if (!next.length || !previous.some(enemy => live.has(enemy.id))) return [...next];
  const known = new Set(previous.map(enemy => enemy.id));
  const additions = next.filter(enemy => !known.has(enemy.id));
  let addition = 0;
  const seats = previous.map(enemy => live.get(enemy.id) ?? additions[addition++] ?? enemy);
  return [...seats, ...additions.slice(addition)];
}

/** Pack actual alpha/UI envelopes, not equal percentage columns. Dense encounters
 * may overlap art in depth, but their identity/intent strips never overlap. */
export function layoutEnemyStage(enemies: readonly BattleSurfaceEnemy[], width: number, height: number, uiWidths: readonly number[] = []) {
  const inset = enemies.length > 4 ? 14 : 20;
  const dense = enemies.length > 4;
  const available=width-inset*2;
  // Reserve edge overhang for the first/last silhouette. Long labels must not
  // consume every horizontal pixel and collapse the art to a tiny strip.
  const uiLimit=dense?Math.min(140,Math.max(92,(available-64-8*(enemies.length-1))/enemies.length)):220;
  const metrics = enemies.map((enemy,index) => {
    const authoredHeight = typeof enemy.artStyle?.height === "number" ? enemy.artStyle.height : ({sentinel:232,amalgam:210,choir:178}[enemy.art] ?? 220);
    const box = enemy.artBounds ?? ENEMY_ART_BOUNDS[enemy.art] ?? {original:[1,1],bounds:[0,0,1,1]} as EnemyArtBounds;
    const [left,top,right,bottom] = box.bounds;
    return {box, authoredHeight, visibleHeight:authoredHeight*(bottom-top)/box.original[1], ratio:(right-left)/(bottom-top),
      uiWidth:Math.max(Math.min(94,uiLimit),Math.min(uiLimit,uiWidths[index] ?? 94)),
      foot:66+(dense&&index%2===0?42:0),
      safeTop:enemy.frenzyActive||enemy.frenzyWarning!==null?58:40};
  });
  let scale = dense ? .96 : 1.16;
  metrics.forEach(metric => {
    scale = Math.min(scale, (height-metric.foot-metric.safeTop)/metric.visibleHeight);
  });
  const measure = (candidate:number) => {
    const frames=metrics.map(metric=>Math.max(metric.uiWidth,metric.visibleHeight*metric.ratio*candidate*1.04+10));
    const centers=frames.map(()=>0);
    if(frames.length)centers[0]=frames[0]/2;
    for(let i=1;i<frames.length;i++) {
      const bodySpacing=(frames[i-1]+frames[i])/2;
      const uiSpacing=(metrics[i-1].uiWidth+metrics[i].uiWidth)/2+8;
      centers[i]=centers[i-1]+(dense?Math.max(uiSpacing,bodySpacing*.56):bodySpacing+18);
    }
    return {frames,centers,span:frames.length?centers.at(-1)!+frames.at(-1)!/2:0};
  };
  if(measure(scale).span>available) {
    let low=0,high=scale;
    for(let step=0;step<24;step++) {
      const middle=(low+high)/2;
      if(measure(middle).span>available)high=middle;else low=middle;
    }
    scale=low;
  }
  const packed=measure(scale),offset=(width-packed.span)/2;
  return metrics.map((metric,index) => {
    const foot = metric.foot;
    const visibleHeight = metric.visibleHeight*scale, visibleWidth = visibleHeight*metric.ratio;
    const center = offset+packed.centers[index],frameWidth=packed.frames[index];
    const zoom = Math.max(1,Math.min(1.04,(height-foot-metric.safeTop+4)/visibleHeight));
    const canvasHeight = metric.authoredHeight*scale;
    const [left,,right,bottom] = metric.box.bounds;
    return {inset,scale,foot,zoom,visibleHeight,visibleWidth,center,frameWidth,uiWidth:metric.uiWidth,
      seatLeft:center-frameWidth/2,
      canvasHeight,canvasWidth:canvasHeight*metric.box.original[0]/metric.box.original[1],
      artLeft:frameWidth/2-(left+right)/2/metric.box.original[1]*canvasHeight,
      // Existing impact animations rest at translateY(-18px); keep that baseline.
      artTop:height-foot-bottom/metric.box.original[1]*canvasHeight+18,
      origin:`${(left+right)/2/metric.box.original[0]*100}% ${bottom/metric.box.original[1]*100}%`,
      frameLeft:center-frameWidth/2,
      frameRight:center+frameWidth/2,
      depth:dense && index%2===0 ? 1 : 2,
    };
  });
}

export type IntentLink = {id:string;fromX:number;fromY:number;toX:number;toY:number};

export type EnemyStageSlot = ReturnType<typeof layoutEnemyStage>[number];
export const ENEMY_REPOSITION_MS = 420;
/** Close only the vacated horizontal space, retaining each survivor's envelope.
 * presentedOrder still contains a dying enemy until its exit animation is done. */
export function compactEnemyStage(seats: readonly BattleSurfaceEnemy[], layout: readonly EnemyStageSlot[], presentedOrder: readonly BattleSurfaceEnemy[], width: number) {
  const byId=new Map(seats.map((enemy,index)=>[enemy.id,layout[index]]));
  const dense=seats.length>4;
  const packed=presentedOrder.flatMap(enemy=>{
    const slot=byId.get(enemy.id);
    return slot?[{...slot,id:enemy.id}]:[];
  });
  let center=0;
  packed.forEach((slot,index)=>{
    const previous=packed[index-1];
    center=index===0?slot.frameWidth/2:center+(dense
      ?Math.max((previous.uiWidth+slot.uiWidth)/2+8,(previous.frameWidth+slot.frameWidth)/2*.56)
      :(previous.frameWidth+slot.frameWidth)/2+18);
    slot.center=center;
  });
  const span=packed.length?center+packed.at(-1)!.frameWidth/2:0;
  const offset=(width-span)/2;
  return packed.map(slot=>({...slot,center:slot.center+offset,seatLeft:slot.center+offset-slot.frameWidth/2,
    frameLeft:slot.center+offset-slot.frameWidth/2,frameRight:slot.center+offset+slot.frameWidth/2}));
}

/** Monotonic ease-out; no spring, overshoot, vertical hop or per-enemy delay. */
export function enemyRepositionProgress(elapsed: number) {
  const t=Math.max(0,Math.min(1,elapsed/ENEMY_REPOSITION_MS));
  return 1-(1-t)**3;
}
/** Both ends live in the gap: below enemy HP, above the party card, never through either. */
export function intentLinkPath(link: IntentLink) {
  const bend = (link.fromY+link.toY)/2;
  return `M ${link.fromX} ${link.fromY} C ${link.fromX} ${bend} ${link.toX} ${bend} ${link.toX} ${link.toY}`;
}
