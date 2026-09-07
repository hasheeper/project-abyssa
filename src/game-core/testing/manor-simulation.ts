import { MANOR_CATALOG_DATA } from "../../content/gameplay/demo-v1/manor";
import { validateDemoCatalog } from "../contracts";
import { createDemoBattleEngine, type DemoEvent } from "../battle";
import { createDemoCampaign, startDemoExpedition, asDemoBattle, fromDemoBattle, continueDemoExpedition, advanceDemoRoom, chooseDemoEvent, chooseDemoExit, layerReady, roomInstance, useDemoItem, type DemoExpeditionState } from "../session";
import { manorBattlePlan } from "./manor-policy";

export function simulateManor(seed: number, policy: "attack" | "survival", hp = 16, cap = 200, partyIds?: string[], supply = true, retainUndo = true) {
  const data = structuredClone(MANOR_CATALOG_DATA); data.enemies["enemy.old-manor.curtain-butler"].hp = hp; data.journey!.handBonusCapPercent = cap;
  const c = validateDemoCatalog(data), engine = createDemoBattleEngine(c), profile = c.data.journey!.defaultProfileId;
  let s = startDemoExpedition(c, profile, createDemoCampaign(c, profile), {runId: `seed-${seed}`, routeId: c.data.journey!.defaultRouteId, seed, partyIds: partyIds ?? c.data.initialParty, itemIds: supply ? c.data.journey!.defaultItems : []}).expedition!;
  const rounds = [0,0,0], downed = [0,0,0], seals = [0,0,0], hits = [0,0,0], endingHp: number[][] = [], costs: number[] = [];
  let commands = 0;
  const update = (r: {state: DemoExpeditionState; events: DemoEvent[]}) => {
    for (const e of r.events) {
      if (e.type === "unit-downed") downed[s.run.layer - 1]++;
      if (e.type === "seal-scheduled") seals[s.run.layer - 1]++;
      if (e.type === "damage-applied" && e.actorId?.includes(":enemy:")) hits[s.run.layer - 1]++;
    }
    s = r.state; commands++;
    if (!retainUndo) s.undo = [];
    if (s.node === "room-complete") endingHp[s.run.layer - 1] = s.run.party.map(p => p.hp);
  };
  for (let guard = 0; guard < 1000 && s.node !== "finished"; guard++) {
    const e = s.encounter;
    if (e) rounds[s.run.layer - 1] = Math.max(rounds[s.run.layer - 1], e.round);
    if (e && (e.phase === "enemy" || e.phase === "complete" || e.phase === "act" && !e.formation.length) || layerReady(c.data, s)) { update(continueDemoExpedition(c, s)); continue; }
    let used = false;
    if (s.node !== "battle" || e && e.itemsUsed < 2) {
      const member = s.run.party.filter(m => m.hp > 0 && m.hp < m.config.maxHp).sort((a,b) => a.hp - b.hp)[0];
      const item = member && s.run.supplies.find(i => i.charges && (i.definitionId === "item.food" && (s.run.foodUses[member.id] ?? 0) < 2 || i.definitionId === "item.potion"));
      if (member && item && (s.node !== "battle" || policy === "survival" || member.hp <= 1)) { update(useDemoItem(c, s, item.instanceId, {kind: "member", id: member.id})); used = true; }
      if (!used && e?.dice.some(d => d.sealed)) {const item = s.run.supplies.find(i => i.charges && i.definitionId === "item.holy-water"); if (item) {update(useDemoItem(c,s,item.instanceId,{kind:"member",id:e.dice.find(d=>d.sealed)!.ownerId}));used=true;}}
    }
    if (used) continue;
    if (s.node === "battle") {
      const plan = manorBattlePlan(c, asDemoBattle(s)!, policy);
      for (const command of plan) {const r = engine.dispatch(asDemoBattle(s)!,command); update({state:fromDemoBattle(r.state),events:r.events});}
    } else if (s.node === "room-complete") update(advanceDemoRoom(c,s,roomInstance(s.run)));
    else if (s.node === "event") update(chooseDemoEvent(c,s,roomInstance(s.run), s.run.layer === 1 ? "read" : "skip", null));
    else if (s.node === "exit") update(chooseDemoExit(c,s,roomInstance(s.run),"leave"));
  }
  if (s.node !== "finished") throw new Error(`Policy stalled seed ${seed}`);
  costs.push(...s.run.supplies.map(i => c.data.journey!.items[i.definitionId].capacity - i.charges));
  return {seed, policy, hp, cap, outcome:s.result.outcome, layer:s.run.layer, rounds, downed, seals, hits, endingHp, supplyUses:costs, gold:s.result.totalGold, layerResults:s.result.layerResults, commands};
}
