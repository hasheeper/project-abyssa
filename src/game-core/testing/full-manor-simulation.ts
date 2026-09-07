import { FULL_MANOR_CATALOG_DATA } from "../../content/gameplay/demo-v1/manor-full";
import { validateManorCatalog } from "../contracts";
import { createDemoBattleEngine, type DemoEvent } from "../battle";
import { createDemoCampaign, startDemoExpedition, settleDemoExpedition, asDemoBattle, fromDemoBattle, continueDemoExpedition, advanceDemoRoom, chooseDemoEvent, chooseDemoExit, layerReady, routeComplete, roomInstance, useDemoItem, type DemoExpeditionState } from "../session";
import { manorBattlePlan } from "./manor-policy";

/** All rooms and HP carry over. The policy can only see the current state. */
export function simulateFullManor(seed: number, policy: "attack" | "survival", hp = 18, maintenance = false, retainUndo = false) {
  const data = structuredClone(FULL_MANOR_CATALOG_DATA);
  data.enemies[data.manor!.boss.definitionId].hp = hp;
  const c = validateManorCatalog(data), engine = createDemoBattleEngine(c), profile = c.data.journey!.defaultProfileId;
  let snapshot = createDemoCampaign(c, profile);
  const run = (routeId: string, runId: string) => {
    snapshot = startDemoExpedition(c, profile, snapshot, {runId, routeId, seed, partyIds: c.data.initialParty, itemIds: c.data.journey!.defaultItems});
    let s = snapshot.expedition!;
    const rounds = [0,0,0,0,0], downed = [0,0,0,0,0], endingHp: number[][] = [];
    const entries = [{layer:1,hp:s.run.party.map(p=>p.hp),rust:s.run.party.map(p=>p.temporaryRust.length),supplies:s.run.supplies.map(i=>i.charges)}];
    const intents={toast:0,summon:0,skipped:0}, seats: {before:number;after:number;reason:string}[]=[];
    let commands = 0, summons = 0;
    const update = (r: {state: DemoExpeditionState; events: DemoEvent[]}) => {
      for (const event of r.events) {
        if (event.type === "unit-downed") downed[s.run.layer - 1]++;
        if (event.type === "enemy-summoned") summons++;
        if (event.type === "banquet-seats-changed") {const p=event.payload as {before:number;after:number;reason:string};seats.push({before:p.before,after:p.after,reason:p.reason});}
        if (event.type === "enemy-intent-resolved") {
          const actor=s.encounter?.enemies.find(e=>e.id===event.actorId);
          if(actor?.definitionId===c.data.manor!.boss.definitionId) {
            if((event.payload as {skipped:boolean}).skipped) intents.skipped++;
            else if(actor.intent?.kind==="attack")intents.toast++;
            else if(actor.intent?.kind==="summon")intents.summon++;
          }
        }
      }
      if(r.state.run.layer!==s.run.layer)entries.push({layer:r.state.run.layer,hp:r.state.run.party.map(p=>p.hp),rust:r.state.run.party.map(p=>p.temporaryRust.length),supplies:r.state.run.supplies.map(i=>i.charges)});
      s = r.state; commands++;
      // This policy never undoes: discard only optional checkpoints to bound simulation cost.
      if (!retainUndo) s.undo = [];
      if (s.node === "room-complete") endingHp[s.run.layer - 1] = s.run.party.map(p => p.hp);
    };
    for (let n = 0; n < 2000 && s.node !== "finished"; n++) {
      const e = s.encounter;
      if (e) rounds[s.run.layer - 1] = Math.max(rounds[s.run.layer - 1], e.round);
      if (e && (e.phase === "enemy" || e.phase === "complete" || e.phase === "act" && !e.formation.length) || layerReady(c.data, s) || routeComplete(c.data, s)) {update(continueDemoExpedition(c,s)); continue;}
      const member = s.run.party.filter(m => m.hp > 0 && m.hp < m.config.maxHp).sort((a,b) => a.hp - b.hp)[0];
      const item = member && s.run.supplies.find(i => i.charges && (i.definitionId === "item.food" && (s.run.foodUses[member.id] ?? 0) < 2 || i.definitionId === "item.potion"));
      if ((s.node !== "battle" || e && e.itemsUsed < 2) && member && item && (s.node !== "battle" || policy === "survival" || member.hp <= 1)) {update(useDemoItem(c,s,item.instanceId,{kind:"member",id:member.id}));continue;}
      const sealed = e?.dice.find(d => d.sealed), holy = s.run.supplies.find(i => i.charges && i.definitionId === "item.holy-water");
      if (sealed && holy && e!.itemsUsed < 2) {update(useDemoItem(c,s,holy.instanceId,{kind:"member",id:sealed.ownerId}));continue;}
      if (s.node === "battle") {
        for (const command of manorBattlePlan(c,asDemoBattle(s)!,policy)) {
          const r = engine.dispatch(asDemoBattle(s)!, command); update({state:fromDemoBattle(r.state),events:r.events});
        }
      } else if (s.node === "room-complete") update(advanceDemoRoom(c,s,roomInstance(s.run)));
      else if (s.node === "event") update(chooseDemoEvent(c,s,roomInstance(s.run),s.run.layer === 2 ? "skip" : "read",null));
      else if (s.node === "exit") update(chooseDemoExit(c,s,roomInstance(s.run),"continue"));
    }
    if (s.node !== "finished") throw new Error(`Policy stalled ${runId}`);
    return {state:s, seed,policy,hp,routeId,outcome:s.result.outcome,layer:s.run.layer,rounds,downed,endingHp,entries,intents,seats,summons,commands,gold:s.result.totalGold,supplyUses:s.run.supplies.map(i=>c.data.journey!.items[i.definitionId].capacity-i.charges)};
  };
  const first = run(c.data.manor!.firstClearRouteId, `first-${seed}`);
  if (!maintenance || first.outcome !== "cleared") return first;
  snapshot = settleDemoExpedition(c,profile,{...snapshot,expedition:first.state},first.state.run.id,first.state.result!.id);
  return run(c.data.manor!.maintenanceRouteId, `maintenance-${seed}`);
}
