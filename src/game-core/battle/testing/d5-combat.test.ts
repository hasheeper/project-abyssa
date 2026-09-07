import { describe, it, expect } from "vitest";
import { D5_CATALOG_DATA } from "../../../content/gameplay/demo-v2/foundation";
import { validateD5Catalog } from "../../contracts/d5-validation";
import { createD5BattleEngine, createD5MemoryEngine } from "../d5-engine";
import { planCleaveFormation, matchesMariettaCovenant, planFormation, applyFormation } from "../rules/v4/formation";
import { memoryProtection, predictEnemyDamage } from "../rules/v4/memory";
import { damageEnemy, finishEncounter } from "../rules/v2/combat";
import { resolveDemoCovenants } from "../rules/v2/covenants";
import { evaluateDemoHand } from "../rules/v2/hand";
import { beginDemoRound, resolveDemoEnemy } from "../rules/v2/lifecycle";
import { createDemoBattleEngine } from "../demo-engine";
import { FULL_MANOR_CATALOG } from "../../../game-runtime/full-manor-context";
import { D5_RUN_READERS } from "../../session/d5-run-readers";
import type { RuleResolution } from "../domain/rule-state";

const catalog = validateD5Catalog(D5_CATALOG_DATA), memory = createD5MemoryEngine(catalog), ordinary = createD5BattleEngine(catalog);
const start = (seed = 41) => memory.create({runId: "memory-run", seed});
const context = (): RuleResolution => ({state: start(), events: []});
function rollFaces(ctx: RuleResolution, faces: number[]) {
  ctx.state.encounter.phase = "act";
  ctx.state.encounter.dice.forEach((d, i) => {d.faceIndex = faces[i] - 1; d.loaded = true;});
}

describe("D5-C deterministic formation", () => {
  it.each([
    [[1,5,2,6],[0,2,1,3],[0,2,1,3]], [[1,1,2,2],[0,1,2,3],[2,0,1,3]],
    [[1,6,1,2],[1,0,2,3],[1,0,2,3]], [[3,3,3,3],[0,1,2,3],[0,1,2,3]],
  ])("matches both agreed stages for %j", (hp, a, b) => {
    const s = start(); s.encounter.enemies.forEach((e,i) => {e.hp = hp[i]; e.intent = {kind:"attack", value:1, targetId:"kael", blocked:0};});
    const ids = [...s.encounter.formation];
    expect(planCleaveFormation(s, 1).after).toEqual(a.map(i => ids[i]));
    expect(planCleaveFormation(s, 2).after).toEqual(b.map(i => ids[i]));
    s.encounter.enemies.forEach((e,i) => {e.id = `renamed-${4-i}`;}); s.encounter.formation = s.encounter.enemies.map(e => e.id);
    expect(planCleaveFormation(s, 2).after.map(id => s.encounter.formation.indexOf(id))).toEqual(b);
  });
  it.each([[[1,1,1,2,2],true],[[1,1,1,1,2],true],[[1,1,1,1,1],true],[[1,1,1,1],false],[[1,1,1,2,3],false]] as const)("broad full house %j", (values, expected) => expect(matchesMariettaCovenant(values)).toBe(expected));
  it("never moves zero/one/two units and never degrades the stronger budget", () => {
    for (let n=0;n<=4;n++) for(let mask=0;mask<4**n;mask++) {
      const s=start(); s.encounter.enemies=s.encounter.enemies.slice(0,n); s.encounter.formation=s.encounter.formation.slice(0,n);
      s.encounter.enemies.forEach((e,i)=>{e.hp=1+Math.floor(mask/4**i)%4;});
      const a=planCleaveFormation(s,1), b=planCleaveFormation(s,2);
      expect(b.scoreAfter[0]).toBeGreaterThanOrEqual(a.scoreAfter[0]);
      if(n<3) expect(b.after).toEqual(b.before);
    }
    expect(()=>planFormation(["a","a"],1,()=>[0,0])).toThrow();
  });
  it("reorders only the formation, retaining locked intents, IDs, effects and queue", () => {
    const ctx=context(); const s=ctx.state; s.encounter.phase="enemy";
    s.encounter.enemies.forEach((e,i)=>{e.hp=[1,5,2,6][i];});
    s.encounter.hand={...evaluateDemoHand(catalog.data,s),covenantOwnerIds:["marietta"]};
    s.encounter.enemyOrder=[...s.encounter.formation]; s.encounter.cursor=1;
    const before=structuredClone(s); applyFormation(ctx,planCleaveFormation(s,1),"marietta","covenant",1);
    expect(s.encounter.formation).not.toEqual(before.encounter.formation);
    expect({...s.encounter,formation:before.encounter.formation}).toEqual(before.encounter);
    expect(s.run).toEqual({...before.run,sequence:before.run.sequence+1});
    expect(()=>applyFormation(ctx,{...planCleaveFormation(s,1),after:["dead"]},"marietta","covenant",1)).toThrow();
  });
});

describe("D5-C memory battle and shared damage", () => {
  it("executes Marietta last using the single frozen wild assignment, without changing the economic full house",()=>{
    const raw=structuredClone(D5_CATALOG_DATA),room=raw.journey!.rooms[raw.routes[raw.manor!.firstClearRouteId].layers[0][0]];
    if(room.kind!=="battle")throw Error("fixture");
    raw.encounters[room.encounterId].enemyIds=Array<string>(4).fill(raw.manor!.boss.guestId);
    const c=validateD5Catalog(raw),e=createD5BattleEngine(c);
    const base=e.create({runId:"sortie",routeId:c.data.manor!.firstClearRouteId,partyIds:["kael","eustice","kororo","norma","marietta"],progress:{appliedGrowthIds:["growth.kororo.lv2","growth.marietta.lv2","growth.marietta.lv3"],equipment:[]},seed:4});
    base.encounter.phase="act";base.encounter.dice.forEach((d,i)=>{d.faceIndex=[5,0,2,0,0][i];});
    base.encounter.enemies.forEach((enemy,i)=>{enemy.hp=[1,1,2,2][i];});
    const hand=e.select(base).hand;
    expect(hand.dice).toHaveLength(5);expect(hand.wildValue).toBe(1);expect(hand.patterns.fullHouse).toBe(false);
    const result=e.dispatch(base,{type:"end-turn"});
    const triggered=result.events.filter(e=>e.type==="covenant-triggered");expect(triggered.at(-1)?.actorId).toBe("marietta");
    expect(result.state.encounter.hand!.wildValue).toBe(hand.wildValue);
    expect(result.state.encounter.enemyOrder).toEqual(base.encounter.formation);
    const sealed=structuredClone(base);sealed.encounter.dice[4].sealed=true;
    expect(e.dispatch(sealed,{type:"end-turn"}).events.some(e=>e.type==="covenant-triggered"&&e.actorId==="marietta")).toBe(false);
  });
  it("creates the fixed five, local supplies, v4 reference and initial MABC protection", () => {
    const s=start(); expect(s.run.party.map(m=>m.hp)).toEqual([3,3,3,3,3]);
    expect(s.run.party.map(m=>m.id)).toEqual(catalog.data.progression.chapter.partyIds);
    expect(s.run.supplies.map(s=>s.source)).toEqual(["memory.marietta.allowance","memory.marietta.allowance"]);
    expect(memoryProtection(s,s.encounter.enemies[0].id)).toBe(1);
    expect(memory.select(s).enemies[0].reorderPreview).toEqual([s.encounter.formation[1],s.encounter.formation[0],...s.encounter.formation.slice(2)]);
    expect(memory.restore(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(()=>createDemoBattleEngine(FULL_MANOR_CATALOG).restore(s)).toThrow();
    expect(()=>ordinary.restore(s)).toThrow();
    expect(()=>memory.create({runId:"x",seed:1,partyIds:["kael"]})).toThrow();
  });
  it("reorders, then attacks a locked target; a bound boss retains its loop", () => {
    const ctx=context(); const s=ctx.state; rollFaces(ctx,[1,2,2,1,2]);
    s.encounter.hand=evaluateDemoHand(catalog.data,s); s.encounter.phase="enemy"; s.encounter.enemyOrder=[...s.encounter.formation];
    const order=[...s.encounter.enemyOrder]; resolveDemoEnemy(catalog.data,ctx);
    expect(memoryProtection(s,s.encounter.enemies[0].id)).toBe(2); expect(s.encounter.enemyOrder).toEqual(order);
    expect(s.encounter.enemies[0].chargeReady).toBe(true);
    beginDemoRound(catalog.data,ctx); const boss=s.encounter.enemies[0]; expect(boss.intent?.kind).toBe("attack");
    boss.boundRound=s.encounter.round; s.encounter.phase="enemy"; s.encounter.hand=evaluateDemoHand(catalog.data,s); s.encounter.enemyOrder=[boss.id];
    resolveDemoEnemy(catalog.data,ctx); expect(boss.chargeReady).toBe(true);
  });
  it("derives protection after compaction, separately for every hit", () => {
    const ctx=context(), s=ctx.state, [m,a,b,c]=s.encounter.enemies;
    s.encounter.formation=[a.id,m.id,b.id,c.id];
    expect(predictEnemyDamage(s,m.id,3)).toMatchObject({applied:1,absorbed:2});
    damageEnemy(catalog.data,ctx,b.id,3,"eustice"); expect(memoryProtection(s,m.id)).toBe(2);
    damageEnemy(catalog.data,ctx,a.id,3,"eustice"); expect(memoryProtection(s,m.id)).toBe(1);
    damageEnemy(catalog.data,ctx,m.id,1,"norma"); expect(m.hp).toBe(18);
    damageEnemy(catalog.data,ctx,c.id,3,"eustice"); expect(memoryProtection(s,m.id)).toBe(0);
    damageEnemy(catalog.data,ctx,m.id,1,"norma"); expect(m.hp).toBe(17);
  });
  it("Kororo uses effective killability instead of raw HP", () => {
    const ctx=context(),s=ctx.state,[m,a,b,c]=s.encounter.enemies; m.hp=2; s.encounter.formation=[a.id,m.id,b.id,c.id];
    rollFaces(ctx,[1,2,3,4,1]); s.encounter.phase="enemy"; s.encounter.hand=evaluateDemoHand(catalog.data,s); s.encounter.hand.covenantOwnerIds=["kororo"];
    resolveDemoCovenants(catalog.data,ctx);
    expect(m.hp).toBe(2); expect(s.encounter.enemies.filter(e=>e.hp===0).length).toBeGreaterThan(0);
  });
  it("closes input after action depletion, finishes one hand and retires remaining puppets without kills", () => {
    const ctx=context(); rollFaces(ctx,[2,2,1,1,1]); ctx.state.encounter.enemies[0].hp=1;
    const s=memory.restore(ctx.state), boss=s.encounter.enemies[0];
    const action=memory.dispatch(s,{type:"act",actorId:"eustice",choice:"attack",targetId:boss.id});
    expect(action.state.encounter.memory!.defeated).toBe(true); expect(action.state.encounter.phase).toBe("act");
    for(const command of [{type:"reroll"},{type:"undo"},{type:"toggle-load",actorId:"elora"}]) expect(()=>memory.dispatch(action.state,command)).toThrow();
    const end=memory.dispatch(action.state,{type:"end-turn"});
    expect(end.state.encounter.outcome).toBe("victory"); expect(end.events.filter(e=>e.type==="hand-settled")).toHaveLength(1);
    expect(end.events.filter(e=>e.type==="enemy-defeated")).toHaveLength(0);
    expect(end.state.run.looseGold).toBe(0); expect(end.state.run.handBonus).toBe(0);
    expect(end.state.encounter.enemies.slice(1).every(e=>e.hp===3&&e.disposition==="released")).toBe(true);
  });
  it("finishes healing after covenant depletion and prevents later hostile knives", () => {
    const ctx=context(),s=ctx.state; rollFaces(ctx,[2,2,2,2,2]); s.run.party[0].hp=1; s.encounter.enemies[0].hp=1;
    // Frozen batch exercises an attack followed by necessary healing, independent of random live hands.
    s.encounter.hand={...evaluateDemoHand(catalog.data,s),covenantOwnerIds:["eustice","norma","elora"],patterns:{flush:true,triple:true,straight:true,twoPair:true,fullHouse:false},hasBlank:true};
    s.encounter.phase="enemy"; s.encounter.enemies[0].intent={kind:"attack",targetId:"kael",value:99,blocked:0};
    resolveDemoCovenants(catalog.data,ctx);
    expect(s.encounter.memory!.defeated).toBe(true); expect(s.run.party[0].hp).toBe(2);
    expect(s.encounter.enemies.slice(1).every(e=>e.hp===3)).toBe(true);
    s.run.party.forEach(m=>{m.hp=0;}); finishEncounter(ctx); expect(s.encounter.outcome).toBe("wipe");
  });
  it("consumes and undoes only local supplies without RNG drift", () => {
    let s=memory.dispatch(start(),{type:"roll"}).state; s.run.party[0].hp=1;
    const before=structuredClone(s), item=s.run.supplies[0];
    const used=memory.useItem(s,{instanceId:item.instanceId,target:{kind:"member",id:"kael"}});
    expect(used.state.run.party[0].hp).toBe(3); expect(used.state.run.supplies[0].charges).toBe(1);
    const undone=memory.dispatch(used.state,{type:"undo"}).state;
    expect(undone.run.rng).toEqual(before.run.rng); expect(undone.run.supplies).toEqual(before.run.supplies);
    expect(()=>memory.useItem(s,{instanceId:"ordinary-inventory",target:{kind:"member",id:"kael"}})).toThrow();
  });
  it("rejects corrupted operation, retirement, template, RNG and foreign undo fields", () => {
    for(const mutate of [
      (s:ReturnType<typeof start>)=>{s.encounter.enemies[0].intent!.operation=undefined;},
      (s:ReturnType<typeof start>)=>{s.encounter.memory!.released=true;},
      (s:ReturnType<typeof start>)=>{s.run.progress.appliedGrowthIds=[];},
      (s:ReturnType<typeof start>)=>{s.run.looseGold=1;},
    ]) {const s=start();mutate(s);expect(()=>D5_RUN_READERS.memory!(catalog,s)).toThrow();}
  });
  it("plays and restores real fixed-template battles through normal commands", () => {
    const results: string[]=[];
    for (let seed=1;seed<=8;seed++) {
      let s=start(seed), steps=0;
      const dispatch=(command:unknown)=>{s=memory.dispatch(s,command).state;s=memory.restore(JSON.parse(JSON.stringify(s)));};
      while(s.encounter.phase!=="complete" && steps++<300) {
        const enc=s.encounter;
        if(enc.phase==="roll") {dispatch({type:"roll"});continue;}
        if(enc.phase==="enemy") {dispatch({type:enc.cursor<enc.enemyOrder.length?"resolve-next-enemy":"next-round"});continue;}
        for(const id of ["kororo","eustice","elora","kael","norma"]) {
          if(s.encounter.memory!.defeated) break;
          const die=s.encounter.dice.find(d=>d.ownerId===id)!;
          if(die.sealed||die.spent||!s.run.party.some(m=>m.id===id&&m.hp>0)) continue;
          if(!die.loaded) dispatch({type:"toggle-load",actorId:id});
          const offered=memory.select(s).party.find(p=>p.id===id)!.actions.options;
          const heal=offered.find(o=>o.choice==="heal"&&s.run.party.find(m=>m.id===o.targetId)!.hp===1);
          const attacks=offered.filter(o=>o.choice==="attack").sort((a,b)=>{
            const score=(o:typeof a)=>{const e=s.encounter.enemies.find(e=>e.id===o.targetId)!;const damage=predictEnemyDamage(s,e.id,o.amount).applied;return damage+(damage>=e.hp?6:0);};return score(b)-score(a);
          });
          const option=heal??attacks[0]??offered[0]; if(option) dispatch({type:"act",actorId:id,choice:option.choice,targetId:option.targetId});
        }
        dispatch({type:"end-turn"});
      }
      expect(steps).toBeLessThan(300); expect(s.encounter.outcome).not.toBeNull();
      expect(s.run.looseGold).toBe(0); expect(s.run.handBonus).toBe(0); results.push(s.encounter.outcome!);
    }
    expect(results).toContain("victory");
  },30000);
});
