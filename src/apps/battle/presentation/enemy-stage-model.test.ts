import { describe, expect, it } from "vitest";
import { ENEMY_ART_BOUNDS, compactEnemyStage, enemyHealthLayers, enemyRepositionProgress, intentLinkPath, layoutEnemyStage, reconcileEnemySeats } from "./enemy-stage-model";
import type { BattleSurfaceEnemy } from "./battle-surface-model";

const enemy = (id: string, art = "enemy.intro.crossbowman", height = 180): BattleSurfaceEnemy => ({
  id, art, name: id, artUrl: "/enemy.png", artStyle: {height}, artBounds: ENEMY_ART_BOUNDS[art],
  hp: 8, maxHp: 8, attack: 2, blocked: 0, intent: null, defeated: false,
  frenzyWarning: null, frenzyActive: false, threat: null, targetable: true, intentBlockable: false,
});
const enemies = [enemy("chief", "enemy.intro.reef-hook-chief", 266), enemy("hauler", "enemy.intro.hauler", 280), enemy("slime", "enemy.intro.tide-slime", 145), enemy("bow")];

describe("layered health", () => {
  it.each([[0,0,0], [8,1,8], [9,2,1], [16,2,8], [17,3,1], [24,3,8], [25,4,1], [32,4,8], [33,5,1], [99,13,3]])("%i HP is layer %i with %i top pearls", (hp,layer,points) => {
    const health = enemyHealthLayers(hp, 99);
    expect(health).toMatchObject({layer,points});
    expect(health.pearls).toHaveLength(8);
    expect(health.pearls.slice(0,points).every(p => p.layer === Math.min(layer,4))).toBe(true);
    expect(health.pearls.slice(points).every(p => p.layer === Math.max(0,Math.min(layer-1,4)))).toBe(true);
    expect(health.pearls.filter(p => p.boundary)).toHaveLength(layer>1&&points<8?1:0);
  });
  it("caps short bars, clamps current health, and labels deep layers", () => {
    expect(enemyHealthLayers(8,8).pearls).toHaveLength(8);
    expect(enemyHealthLayers(12,8).points).toBe(8);
    expect(enemyHealthLayers(-1,8).layer).toBe(0);
    expect(enemyHealthLayers(33,99).number).toBe("Ⅴ");
    expect(enemyHealthLayers(80,99).number).toBe("Ⅹ");
    expect(enemyHealthLayers(32,32).showLayerNumber).toBe(false);
    expect(enemyHealthLayers(33,33).showLayerNumber).toBe(true);
    expect(enemyHealthLayers(5,5).pearls).toHaveLength(5);
  });
});

describe("stable enemy seats", () => {
  it("retains vacant art envelopes through death and undo", () => {
    const initial = enemies.slice(0,3);
    const after = reconcileEnemySeats(initial,[initial[0],initial[2]]);
    expect(after).toEqual(initial);
    expect(layoutEnemyStage(after,880,343)).toEqual(layoutEnemyStage(initial,880,343));
    expect(reconcileEnemySeats(after,initial)).toEqual(initial);
  });
  it("honours explicit rule order and replaces a completed encounter", () => {
    const order=[enemies[2],enemies[0],enemies[1],enemies[3]];
    const seats=reconcileEnemySeats(enemies,order);
    expect(seats.map(e=>e.id)).toEqual(enemies.map(e=>e.id));
    expect(compactEnemyStage(seats,layoutEnemyStage(seats,880,343),order,880).map(e=>e.id)).toEqual(["slime","chief","hauler","bow"]);
    expect(reconcileEnemySeats(enemies,[enemy("new")])).toEqual([enemy("new")]);
  });
  it("reuses holes even after many waves of summons", () => {
    let seats = Array.from({length:8},(_,i)=>enemy(`initial-${i}`));
    for (let wave=0;wave<20;wave++) {
      const alive=seats.filter((_,i)=>i%2===0);
      seats=reconcileEnemySeats(seats,alive);
      const next=[...alive,...Array.from({length:4},(_,i)=>enemy(`wave-${wave}-${i}`))];
      seats=reconcileEnemySeats(seats,next);
      expect(new Set(seats.map(e=>e.id))).toEqual(new Set(next.map(e=>e.id)));
      expect(seats).toHaveLength(8);
    }
  });
});

describe("horizontal vacancy closing",()=>{
  it("closes 8→7→4→1 without resizing survivors or changing their depth",()=>{
    const seats=Array.from({length:8},(_,index)=>({...enemies[index%4],id:`e-${index}`}));
    const envelope=layoutEnemyStage(seats,1038,359);
    for(const count of [8,7,4,1]) {
      const alive=seats.slice(8-count),packed=compactEnemyStage(seats,envelope,alive,1038);
      for(const slot of packed) {
        const original=envelope[seats.findIndex(enemy=>enemy.id===slot.id)];
        expect(slot).toMatchObject({canvasHeight:original.canvasHeight,canvasWidth:original.canvasWidth,artTop:original.artTop,foot:original.foot,depth:original.depth});
      }
      expect((packed[0].frameLeft+packed.at(-1)!.frameRight)/2).toBeCloseTo(519);
      expect(compactEnemyStage(seats,envelope,seats,1038).map(s=>s.center)).toEqual(envelope.map(s=>s.center));
    }
  });
  it("eases monotonically without overshoot or a vertical bounce",()=>{
    const samples=Array.from({length:43},(_,i)=>enemyRepositionProgress(i*10));
    expect(samples[0]).toBe(0);expect(samples.at(-1)).toBe(1);
    expect(samples.every((p,i)=>p>=0&&p<=1&&(!i||p>=samples[i-1]))).toBe(true);
    expect(enemyRepositionProgress(210)).toBeCloseTo(.875);
    expect(enemyRepositionProgress(1000)).toBe(1);
  });
});

describe("measured stage geometry", () => {
  for (const height of [343,361]) for (const count of [1,3,8]) {
    it(`${count} enemies stay inside the ${height}px stage, including hovered art`, () => {
      const formation=Array.from({length:count},(_,i)=>({...enemies[i%4],id:`enemy-${i}`}));
      const layout=layoutEnemyStage(formation,880,height);
      expect(new Set(layout.map(s=>s.scale)).size).toBe(1);
      for (const slot of layout) {
        expect(slot.zoom).toBeGreaterThanOrEqual(1);
        expect(slot.zoom).toBeLessThanOrEqual(1.04);
        expect(height-slot.foot-slot.visibleHeight*slot.zoom).toBeGreaterThanOrEqual(35.9);
        expect(slot.center-slot.visibleWidth*slot.zoom/2).toBeGreaterThanOrEqual(6.9);
        expect(slot.center+slot.visibleWidth*slot.zoom/2).toBeLessThanOrEqual(873.1);
        expect(slot.frameLeft).toBeGreaterThanOrEqual(5);
        expect(slot.frameRight).toBeLessThanOrEqual(875);
      }
      if(count===8) expect(layout.map(s=>s.foot)).toEqual([108,66,108,66,108,66,108,66]);
    });
  }
  it("fits each selection frame to its own alpha envelope rather than equal columns", () => {
    const layout=layoutEnemyStage(enemies,1038,359);
    expect(new Set(layout.map(s=>s.frameWidth)).size).toBeGreaterThan(2);
    layout.forEach(slot=>expect(slot.frameWidth).toBeCloseTo(Math.max(94,slot.visibleWidth*1.04+10)));
    const dense=layoutEnemyStage([...enemies,...enemies],1038,359);
    for(let i=1;i<dense.length;i++)expect(dense[i].center-dense[i-1].center).toBeGreaterThanOrEqual(102);
  });
  it("caps long identity strips independently of overlapping art at eight enemies", () => {
    const dense=layoutEnemyStage([...enemies,...enemies],880,343,Array(8).fill(300));
    expect(dense.every(s=>s.visibleHeight>40&&s.frameWidth>=s.uiWidth)).toBe(true);
    expect(dense.every(s=>s.uiWidth>=82)).toBe(true); // eight 8px pearls + six 2px gaps + group gap
    for(let i=1;i<dense.length;i++) {
      expect(dense[i].center-dense[i].uiWidth/2).toBeGreaterThanOrEqual(dense[i-1].center+dense[i-1].uiWidth/2+7.99);
    }
  });
  it("keeps the curve wholly between the health strip and the party card", () => {
    expect(intentLinkPath({id:"a",fromX:150,fromY:356,toX:730,toY:390})).toBe("M 150 356 C 150 373 730 373 730 390");
  });
});
