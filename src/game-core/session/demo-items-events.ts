import type { RuleContext, RuleRun, RuleExpeditionRun } from "../battle/domain/rule-state";
import { eventFaceMethod } from "../battle/rules/v2/event-face";
export { eventFaceMethod } from "../battle/rules/v2/event-face";
import type { ValidatedDemoCatalog } from "../contracts/demo";
import * as v from "../contracts/validation";
import { demoRoom } from "../contracts/demo-journey-validation";
import { drawRngValue } from "../battle/persistence/rng";
import { randomInt } from "../battle/rules/v2/combat";
import { asDemoBattle, journeyEvent, roomInstance, validateDemoExpedition, type DemoExpeditionState, type DemoExpeditionResolution } from "./demo-expedition";

export type DemoItemTarget = { kind: "member"; id: string; faceId?: string } | { kind: "intent"; id: string } | { kind: "round" } | { kind: "information"; scope: "next-layer" | "event" };
export function parseDemoItemTarget(raw: unknown): DemoItemTarget {
  const r = v.record(raw, "item.target"), kind = v.choice(r.kind, ["member", "intent", "round", "information"], "target.kind");
  if (kind === "member") { v.record(r, "target", ["kind", "id", ...(r.faceId !== undefined ? ["faceId"] : [])]); return {kind, id: v.id(r.id, "target.id"), ...(r.faceId !== undefined ? {faceId: v.id(r.faceId, "target.faceId")} : {})}; }
  if (kind === "intent") { v.record(r, "target", ["kind", "id"]); return {kind, id: v.id(r.id, "target.id")}; }
  if (kind === "information") { v.record(r, "target", ["kind", "scope"]); return {kind, scope: v.choice(r.scope, ["next-layer", "event"], "target.scope")}; }
  v.record(r, "target", ["kind"]); return {kind};
}
export function chooseRuleEvent<R extends RuleExpeditionRun>(catalog: RuleContext, input: DemoExpeditionState<R>, id: string, choice: "read" | "attempt" | "skip", actorId: string | null, read: (raw: unknown) => DemoExpeditionState<R>): DemoExpeditionResolution<R> {
  const state = read(input), run = state.run, room = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  if (state.node !== "event" || room.kind !== "event" || id !== roomInstance(run)) v.invalid("event", "Event is not waiting for input", "command-not-available");
  const def = catalog.data.journey!.events[room.eventId];
  if (choice !== "skip" && choice !== (def.kind !== "relic" ? "read" : "attempt")) v.invalid("choice", "Unknown event choice");
  let faceId: string | null = null, method: "read" | "skip" | "strong" | "weak" | "failed" = choice === "read" ? "read" : "skip", cost = 0, reward = 0;
  if (choice === "attempt") {
    const actor = run.party.find(m => m.id === actorId && m.hp > 0);
    if (!actor) v.invalid("actor", "A living participant is required", "invalid-target");
    if (run.looseGold < def.cost) v.invalid("cost", "Not enough loose gold", "insufficient-funds");
    const draw = drawRngValue(run.eventRng); run.eventRng = draw.stream;
    const face = actor.config.faces[Math.floor(draw.value * 6)]; faceId = face.id;
    method = eventFaceMethod(catalog.data, face); cost = def.cost; reward = method === "failed" ? 0 : def.reward;
    run.looseGold += reward - cost;
  } else if (actorId !== null) v.invalid("actorId", "This choice needs no participant");
  const result = {roomId: id, eventId: def.id, choiceId: choice, actorId, faceId, method, cost, reward};
  run.eventResults.push(result); run.completedRoomIds.push(id);
  const next: DemoExpeditionState<R> = {run, node: "room-complete", encounter: null, undo: [], result: null};
  return {state: next, events: [journeyEvent(next, "event-resolved", {...result}, actorId), journeyEvent(next, "room-completed", {roomId: id, layer: run.layer})]};
}
/** Read-only legal targets for a validated expedition. Shared by commands and UI queries. */
export function demoItemTargets(catalog: RuleContext, state: DemoExpeditionState<RuleRun>, instanceId: string): DemoItemTarget[] {
  const run = state.run, enc = state.encounter;
  if (state.node === "finished" || enc && (!["roll", "act"].includes(enc.phase) || !enc.formation.length || enc.itemsUsed >= 2)) return [];
  const item = run.supplies.find(i => i.instanceId === instanceId && i.charges > 0);
  if (!item) return [];
  const kind = catalog.data.journey!.items[item.definitionId].kind;
  if (kind === "ward") return enc?.enemies.filter(e => e.hp > 0 && e.intent?.kind === "attack" && e.boundRound !== enc.round).map(e => ({kind: "intent", id: e.id})) ?? [];
  if (kind === "lucky-charm") return enc?.phase === "act" && enc.dice.some(d => !d.loaded && !d.spent && !d.sealed && run.party.some(m => m.id === d.ownerId && m.hp > 0)) ? [{kind: "round"}] : [];
  if (kind === "divination-slip") {
    if (enc) return [];
    const choices: DemoItemTarget[] = [];
    if (state.node === "event" && !run.revealed.includes(roomInstance(run))) choices.push({kind: "information", scope: "event"});
    if (run.layer < catalog.data.routes[run.routeId].layers.length && !run.revealed.includes(`layer:${run.layer + 1}`)) choices.push({kind: "information", scope: "next-layer"});
    return choices;
  }
  return run.party.filter(m => m.hp > 0).flatMap((m): DemoItemTarget[] => {
    if (kind === "maintenance-kit") return m.temporaryRust.map(faceId => ({kind: "member", id: m.id, faceId}));
    if (kind === "holy-water") return enc?.dice.some(d => d.ownerId === m.id && d.sealed) ? [{kind: "member", id: m.id}] : [];
    return m.hp < m.config.maxHp && (kind !== "food" || (run.foodUses[m.id] ?? 0) < 2) ? [{kind: "member", id: m.id}] : [];
  });
}
export function useRuleItem<R extends RuleExpeditionRun>(catalog: RuleContext, input: DemoExpeditionState<R>, instanceId: string, target: DemoItemTarget, read: (raw: unknown) => DemoExpeditionState<R>): DemoExpeditionResolution<R> {
  const state = read(input), run = state.run, battle = asDemoBattle(state);
  if (state.node === "finished" || battle && (!["roll", "act"].includes(battle.encounter.phase) || !battle.encounter.formation.length || battle.encounter.itemsUsed >= 2)) v.invalid("item", "Item input is closed", "command-not-available");
  const item = run.supplies.find(i => i.instanceId === instanceId && i.charges > 0);
  if (!item) v.invalid("item", "No remaining supply", "item-unavailable");
  const def = catalog.data.journey!.items[item.definitionId], events: DemoExpeditionResolution["events"] = [];
  const emit = (type: string, payload: DemoExpeditionResolution["events"][number]["payload"]) => events.push(journeyEvent(state, type, payload));
  function fail(): never { return v.invalid("target", "Item has no valid effect on this target", "invalid-target"); }
  if (!demoItemTargets(catalog, state, instanceId).some(option => v.canonicalJson(option) === v.canonicalJson(target))) fail();
  if (battle?.encounter.phase === "act") state.undo.push({run: structuredClone(run), encounter: structuredClone(battle.encounter)});
  if (["food", "potion", "holy-water", "maintenance-kit"].includes(def.kind)) {
    if (target.kind !== "member") fail();
    const member = run.party.find(m => m.id === target.id && m.hp > 0); if (!member) fail();
    if (def.kind !== "maintenance-kit" && target.faceId !== undefined) fail();
    if (def.kind === "food" || def.kind === "potion") {
      if (member.hp === member.config.maxHp || def.kind === "food" && (run.foodUses[member.id] ?? 0) >= 2) fail();
      const before = member.hp; member.hp = Math.min(member.config.maxHp, member.hp + (def.kind === "food" ? 1 : 2));
      if (def.kind === "food") run.foodUses[member.id] = (run.foodUses[member.id] ?? 0) + 1;
      emit("healing-applied", {targetId: member.id, applied: member.hp - before, hpAfter: member.hp});
    } else if (def.kind === "maintenance-kit") {
      if (!target.faceId || !member.temporaryRust.includes(target.faceId)) fail();
      member.temporaryRust = member.temporaryRust.filter(id => id !== target.faceId);
    } else {
      const die = battle?.encounter.dice.find(d => d.ownerId === member.id); if (!die?.sealed) fail();
      die.sealed = false;
      if (battle!.encounter.phase === "act" && die.faceIndex === null) { die.faceIndex = randomInt(battle!, 0, 5); emit("dice-rolled", {ownerIds: [member.id], reroll: false}); }
      emit("status-cleansed", {targetId: member.id, statusId: "status.sealed"});
    }
  } else if (def.kind === "ward") {
    if (!battle || target.kind !== "intent") fail();
    const enemy = battle.encounter.enemies.find(e => e.id === target.id && e.hp > 0 && e.intent?.kind === "attack");
    if (!enemy?.intent || enemy.boundRound === battle.encounter.round) fail();
    enemy.intent.blocked += 2; emit("guard-applied", {enemyId: enemy.id, targetId: enemy.intent.targetId, amount: 2});
  } else if (def.kind === "lucky-charm") {
    if (!battle || target.kind !== "round" || battle.encounter.phase !== "act" || !battle.encounter.dice.some(d => !d.loaded && !d.spent && !d.sealed && run.party.some(m => m.id === d.ownerId && m.hp > 0))) fail();
    battle.encounter.rerolls++; battle.encounter.extraRerolls++;
  } else {
    if (battle || target.kind !== "information") fail();
    let key: string;
    if (target.scope === "event") { if (state.node !== "event") fail(); key = roomInstance(run); }
    else { if (run.layer >= catalog.data.routes[run.routeId].layers.length) fail(); key = `layer:${run.layer + 1}`; }
    if (run.revealed.includes(key)) fail();
    run.revealed.push(key); state.undo = []; emit("information-revealed", {targetId: key, roomId: roomInstance(run)});
  }
  item.charges--; if (battle) battle.encounter.itemsUsed++;
  emit("item-used", {instanceId, definitionId: item.definitionId, roomId: roomInstance(run), target, remaining: item.charges});
  return {state: read(state), events};
}

export function chooseDemoEvent(catalog: ValidatedDemoCatalog, input: DemoExpeditionState, id: string, choice: "read" | "attempt" | "skip", actorId: string | null) {
  return chooseRuleEvent(catalog, input, id, choice, actorId, raw => validateDemoExpedition(catalog, raw));
}
export function useDemoItem(catalog: ValidatedDemoCatalog, input: DemoExpeditionState, instanceId: string, target: DemoItemTarget) {
  return useRuleItem(catalog, input, instanceId, target, raw => validateDemoExpedition(catalog, raw));
}
