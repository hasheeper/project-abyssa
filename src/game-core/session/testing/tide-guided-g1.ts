import type { D5Catalog, ValidatedD5Catalog } from "../../contracts/d5";
import { validateD5Catalog } from "../../contracts/d5-validation";
import type { DemoBattleCommand, DemoEvent } from "../../battle/domain/demo-state";
import { drawRngValue } from "../../battle/persistence/rng";
import { demoActionOptions } from "../../battle/rules/v2/combat";
import { evaluateDemoHand } from "../../battle/rules/v2/hand";
import { createD5ExpeditionEngine, type D5JourneyOperation } from "../d5-expedition";
import type { D5ExpeditionState } from "../d5-types";
import { initialD5Projection } from "../d5-progress";
import { asDemoBattle, layerReady, roomInstance, routeComplete } from "../demo-expedition";
import { demoItemTargets } from "../demo-items-events";
import { tutorialNextOperation } from "./tutorial-driver";
import { createD5BattleEngine } from "../../battle/d5-engine";

/** Offline G1 laboratory only. Never imported by the player runtime. */
export const G1_PLAN = "tide-guided-g1/2026-09-13";
export const G1_CONTINUATION_SEED = 11_395_852;
export const G1_STANDARD_OPERATION_DIGEST = "8eec9a1d41e83b42e0b7e8f86984962e18a70fadc9590b3b0838d9b4c186dcc3";
export class CandidateRejected extends Error {}
export function requireG1(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new CandidateRejected(reason);
}

export function g1Snapshot(state: D5ExpeditionState) {
  return structuredClone({
    room: state.run.room, node: state.node, round: state.encounter?.round ?? null,
    phase: state.encounter?.phase ?? null, story: state.tutorial?.story ?? null,
    rng: state.run.rng, eventRng: state.run.eventRng,
    party: state.run.party.map(m => ({ id: m.id, hp: m.hp, rust: m.temporaryRust })),
    dice: state.encounter?.dice ?? [], enemies: state.encounter?.enemies ?? [],
    supplies: state.run.supplies, looseGold: state.run.looseGold, bankedGold: state.run.bankedGold, handBonus: state.run.handBonus,
  });
}
export type G1TraceRow = {
  label: string; operation: D5JourneyOperation;
  before: ReturnType<typeof g1Snapshot>; after: ReturnType<typeof g1Snapshot>; events: DemoEvent[];
};

/** Reconstruct each consumed draw for the evidence file; never mutates the run. */
export function g1RngEvidence(initial: ReturnType<typeof g1Snapshot>, trace: G1TraceRow[]) {
  const streams = (s: ReturnType<typeof g1Snapshot>) => ({...s.rng, event: s.eventRng});
  const evidence: {label: string; stream: string; seed: number; cursor: number; value: number}[] = [];
  const append = (label: string, after: ReturnType<typeof streams>, before?: ReturnType<typeof streams>) => {
    for (const key of ["combat", "loot", "flavor", "event"] as const) {
      const previous = before?.[key], next = after[key];
      let stream = {...next, cursor: previous?.seed === next.seed ? previous.cursor : 0};
      while (stream.cursor < next.cursor) {
        const draw = drawRngValue(stream); stream = draw.stream;
        evidence.push({label, stream: key, seed: stream.seed, cursor: stream.cursor, value: draw.value});
      }
    }
  };
  append("create", streams(initial));
  trace.forEach(row => append(row.label, streams(row.after), streams(row.before)));
  return evidence;
}
export class G1Recorder {
  readonly engine;
  readonly trace: G1TraceRow[] = [];
  readonly events: DemoEvent[] = [];
  readonly initial: ReturnType<typeof g1Snapshot>;
  state: D5ExpeditionState;
  constructor(readonly catalog: ValidatedD5Catalog, seed: number, readonly record = true, ordinary = false) {
    this.engine = createD5ExpeditionEngine(catalog);
    const campaign = initialD5Projection(catalog), spec = catalog.data.tutorial!;
    campaign.prologue!.status = "skipped";
    campaign.opening!.status = "viewed";
    this.state = this.engine.create(campaign, {runId: "g1-run", routeId: ordinary ? catalog.data.manor!.firstClearRouteId : spec.routeId,
      partyIds: ordinary ? catalog.data.initialParty : spec.partyIds, itemIds: ordinary ? ["item.food", "item.potion"] : spec.itemIds, seed});
    this.initial = g1Snapshot(this.state);
  }
  step(operation: D5JourneyOperation, label: string) {
    const before = this.record ? g1Snapshot(this.state) : null;
    const result = this.engine.dispatch(this.state, operation);
    this.state = result.state;
    this.events.push(...result.events);
    if (before) this.trace.push({ label, operation, before, after: g1Snapshot(this.state), events: result.events });
    return result.events;
  }
  battle(command: DemoBattleCommand, label: string) { return this.step({type: "battle", command}, label); }
  act(actorId: string, choice: "attack" | "guard" | "heal", targetId: string, label: string) {
    if (!this.state.encounter!.dice.find(d => d.ownerId === actorId)!.loaded)
      this.battle({type: "toggle-load", actorId}, `${label}.fix`);
    return this.battle({type: "act", actorId, choice, targetId}, label);
  }
  read(label: string) {
    const story = this.state.tutorial!.story!;
    this.step({type: "tutorial-read", storyId: story.id, step: story.step, choice: story.id === "S3-4" ? "A" : "continue"}, label);
  }
  advance(label: string) { this.step({type: "advance", roomId: roomInstance(this.state.run)}, label); }
  drain(label: string) {
    for (let i = 0; i < 20; i++) {
      const e = this.state.encounter;
      if (!e || this.state.tutorial?.story || this.state.tutorial?.stage === "failed" ||
          !(["enemy", "complete"].includes(e.phase) || e.phase === "act" && !e.formation.length)) return;
      this.step({type: "resume"}, `${label}.${i + 1}`);
    }
    throw Error("G1 resume did not terminate");
  }
  enemy(suffix: string) {
    const enemy = this.state.encounter!.enemies.find(e => e.definitionId.endsWith(suffix));
    if (!enemy) throw Error(`Missing ${suffix}`);
    return enemy.id;
  }
  faces() { return this.state.encounter!.dice.map(d => d.faceIndex === null ? null : d.faceIndex + 1); }
}

export function g1BattleOne(r: G1Recorder) {
  r.read("T1.arrival"); r.battle({type: "roll"}, "T1.R1.roll");
  const [one, two] = r.state.encounter!.enemies.map(e => e.id);
  r.act("kael", "attack", one, "T1.R1.kael"); r.act("eustice", "attack", one, "T1.R1.eustice");
  r.battle({type: "end-turn"}, "T1.R1.end"); r.drain("T1.R1.resolve");
  r.battle({type: "roll"}, "T1.R2.roll"); r.act("eustice", "attack", two, "T1.R2.eustice");
  r.drain("T1.R2.resolve");
  requireG1(r.state.tutorial?.story?.id === "S3-2", "T1 did not finish");
  requireG1(r.state.run.party.map(m => m.hp).join() === "3,2,3,3,3", "T1 HP changed");
  r.read("T1.interlude"); r.advance("T2.enter");
}

/** Cheap sieve uses the real RNG only; it is not the acceptance test. */
export function g1SeedSieve(seed: number) {
  let stream = {algorithm: "mulberry32" as const, seed, cursor: 0};
  const draw = () => { const d = drawRngValue(stream); stream = d.stream; return d.value; };
  const event = drawRngValue({algorithm: "mulberry32", seed: (seed ^ 0x3c6ef372) >>> 0, cursor: 0});
  if (![1, 3].includes(1 + Math.floor(event.value * 6))) return false;
  draw();
  const first = Array.from({length: 5}, () => 1 + Math.floor(draw() * 6));
  if (![2, 3].includes(first[1])) return false;
  // Do not teach a compulsory reroll where all enemies could already be cleared.
  const powers = [[1,1,0,0,0,1], [1,2,2,3,0,0], [0,0,0,0,2,0], [0,0,0,4,4,5], [1,2,0,0,0,3]];
  if (first.reduce((sum, slot, i) => sum + powers[i][slot - 1], 0) >= 8) return false;
  const reroll = [1 + Math.floor(draw() * 6), first[1], ...Array.from({length: 3}, () => 1 + Math.floor(draw() * 6))];
  if (![3, 5].includes(reroll[0]) || reroll[2] > 4 || reroll[3] > 3 || ![3,4,5].includes(reroll[4])) return false;
  // With no covenant draw in round one, these are the two shooting-round targets.
  if (Math.floor(draw() * 5) !== Math.floor(draw() * 5)) return false;
  const second = Array.from({length: 5}, () => 1 + Math.floor(draw() * 6));
  if (![1,2].includes(second[0]) || second[1] !== 5 || second[2] === 6 || second[4] === 1) return false;
  const bowDamage = second.slice(2).reduce((sum, slot, i) => sum + powers[i + 2][slot - 1], 0);
  return bowDamage >= 2 && bowDamage <= 4;
}

function available(r: Pick<G1Recorder, "state" | "catalog">) {
  const state = asDemoBattle(r.state)!;
  return state.encounter.dice.flatMap(die => {
    const preview = {...state, encounter: {...state.encounter, dice: state.encounter.dice.map(d => d === die ? {...d, loaded: true} : d)}};
    return demoActionOptions(r.catalog.data, preview, die.ownerId).options.map(option => ({actorId: die.ownerId, ...option}));
  });
}

/** Use remaining useful actions; never invent damage or consume an extra reroll. */
function useRound(r: G1Recorder, label: string, attackTarget: string | null, guardTarget: string | null) {
  for (let i = 0; i < 6; i++) {
    const options = available(r);
    const option = options.find(o => o.choice === "attack" && o.targetId === attackTarget)
      ?? options.find(o => o.choice === "guard" && o.targetId === guardTarget && r.state.encounter!.enemies.find(e => e.id === guardTarget)!.intent!.blocked < 1)
      ?? options.find(o => o.choice === "heal");
    if (!option) return;
    requireG1(option.choice === "attack" || option.choice === "guard" || option.choice === "heal", "unexpected option");
    r.act(option.actorId, option.choice, option.targetId!, `${label}.${option.actorId}.${option.choice}`);
  }
  throw Error("Too many useful actions");
}

export function g1Candidate(seed: number, catalog: ValidatedD5Catalog, record = true) {
  const r = new G1Recorder(catalog, seed, record);
  g1BattleOne(r);
  r.battle({type: "roll"}, "T2.R1.roll");
  r.battle({type: "toggle-load", actorId: "eustice"}, "T2.R1.keep");
  r.battle({type: "reroll"}, "T2.R1.reroll");
  const knife = r.enemy("lookout"), bow = r.enemy("crossbowman");
  r.act("eustice", "attack", knife, "T2.R1.eustice");
  useRound(r, "T2.R1", null, knife);
  r.battle({type: "end-turn"}, "T2.R1.end"); r.drain("T2.R1.resolve");
  requireG1(r.state.encounter?.round === 2 && r.state.encounter.enemies.every(e => e.hp > 0), "T2 R1 covenant changed enemies");
  const intents = r.state.encounter.enemies.map(e => e.intent);
  requireG1(intents.every(i => i?.kind === "attack") && intents[0]!.targetId === intents[1]!.targetId, "T2 targets diverge");
  r.battle({type: "roll"}, "T2.R2.roll");
  requireG1(r.faces()[1] === 5 && [1,2].includes(r.faces()[0]!), "T2 R2 slots diverge");
  r.act("eustice", "guard", bow, "T2.R2.guard-bow");
  r.act("kael", "attack", knife, "T2.R2.kill-knife");
  useRound(r, "T2.R2", bow, null);
  requireG1(r.state.encounter!.enemies.find(e => e.id === bow)!.hp > 0, "Bow killed before guard resolves");
  const eventIndex = r.events.length;
  r.battle({type: "end-turn"}, "T2.R2.end"); r.drain("T2.R2.resolve");
  requireG1(r.events.slice(eventIndex).some(e => e.type === "damage-applied" && e.actorId === bow &&
    g1Payload(e).targetKind === "party-member" && g1Payload(e).applied === 0), "No real blocked-arrow receipt");
  for (let i = 0; i < 70 && r.state.tutorial!.story?.id !== "S3-3"; i++) {
    requireG1(r.state.encounter!.round <= 3, "T2 exceeds three rounds");
    const op = tutorialNextOperation(catalog, r.state, "tactical");
    requireG1(op, "T2 stalled"); r.step(op, "T2.R3.finish");
  }
  requireG1(r.state.tutorial!.story?.id === "S3-3", "T2 unfinished");
  requireG1(!r.events.some(e => e.type === "unit-downed"), "Downed before T3");
  requireG1(r.state.run.supplies.every(s => s.charges === (s.definitionId === "item.food" ? 4 : 2)), "T2 needed a supply");
  requireG1(r.state.run.looseGold === 2, "T2 spent gold");
  r.read("T2.interlude");
  const food = r.state.run.supplies.find(s => s.definitionId === "item.food")!;
  const target = demoItemTargets(catalog, r.state, food.instanceId)[0];
  if (target) r.step({type: "item", instanceId: food.instanceId, target}, "S3-3.food");
  r.advance("T3.enter"); r.battle({type: "roll"}, "T3.R1.roll");
  const hand = evaluateDemoHand(catalog.data, asDemoBattle(r.state)!);
  requireG1(hand.name === "两对" && hand.patterns.twoPair && hand.hasBlank && hand.covenantOwnerIds.includes("norma") &&
    !hand.patterns.flush && !hand.patterns.triple && !hand.patterns.straight, "T3 not clean two-pair + blank");
  const scout = r.enemy("lookout"), crossbow = r.enemy("crossbowman"), hauler = r.enemy("hauler");
  // Neither actor can kill alone; together they remove the three-HP threat.
  const attacks = available(r).filter(o => o.choice === "attack" && o.targetId === scout).sort((a,b) => a.amount - b.amount);
  const pair = attacks.flatMap((a,i) => attacks.slice(i + 1).map(b => [a,b])).find(p => p[0].actorId !== p[1].actorId && p.every(a => a.amount < 3) && p[0].amount + p[1].amount >= 3);
  requireG1(pair, "T3 no two-actor focus fire");
  for (const a of pair) r.act(a.actorId, "attack", scout, `T3.R1.focus.${a.actorId}`);
  useRound(r, "T3.R1", crossbow, hauler);
  const start = r.events.length;
  r.battle({type: "end-turn"}, "T3.R1.end"); r.drain("T3.R1.resolve");
  const events = r.events.slice(start);
  requireG1(events.some(e => e.type === "covenant-triggered" && e.actorId === "norma"), "No Norma covenant");
  requireG1(events.some(e => e.type === "damage-applied" && e.actorId === "norma" && g1Payload(e).targetKind === "enemy" && Number(g1Payload(e).applied) > 0), "No actual knives damage");
  requireG1(r.state.run.party.every(m => m.hp > 0), "Downed during T3 lesson");
  return r;
}

export function g1Payload(event: DemoEvent): Record<string, unknown> {
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return {};
  return event.payload;
}

export type G1BossStrategy = "crossbow-first" | "chief-first" | "ignore-intents";
/** Transparent non-optimal comparison policies. No search over future rolls. */
export function g1FreeOperation(catalog: ValidatedD5Catalog, state: D5ExpeditionState, strategy: G1BossStrategy): D5JourneyOperation | null {
  if (state.tutorial && ["claimable", "failed"].includes(state.tutorial.stage)) return null;
  if (state.node === "room-complete") return layerReady(catalog.data, state) || routeComplete(catalog.data, state)
    ? {type: "resume"} : {type: "advance", roomId: roomInstance(state.run)};
  const battle = asDemoBattle(state);
  if (!battle) return null;
  if (battle.encounter.phase === "roll") return {type: "battle", command: {type: "roll"}};
  if (battle.encounter.phase !== "act" || !battle.encounter.formation.length) return {type: "resume"};
  const options = available({catalog, state});
  const selected = createD5BattleEngine(catalog).select(battle);
  const enemy = (id: string | null) => selected.enemies.find(e => e.id === id)!;
  const action = (o: typeof options[number]): D5JourneyOperation => ({type: "battle", command:
    battle.encounter.dice.find(d => d.ownerId === o.actorId)!.loaded
      ? {type: "act", actorId: o.actorId, choice: o.choice, targetId: o.targetId}
      : {type: "toggle-load", actorId: o.actorId}});
  const incoming = (id: string) => selected.enemies.filter(e => e.intent?.targetId === id).reduce((n,e) => n + e.damage, 0);
  const danger = battle.run.party.filter(m => m.hp > 0 && incoming(m.id) >= m.hp);
  if (strategy !== "ignore-intents") {
    const guard = options.find(o => o.choice === "guard" && enemy(o.targetId).damage > 0 && danger.some(m => m.id === enemy(o.targetId).intent?.targetId));
    if (guard) return action(guard);
    const heal = options.find(o => o.choice === "heal" && danger.some(m => m.id === o.targetId));
    if (heal) return action(heal);
    const potion = state.run.supplies.find(s => s.definitionId === "item.potion" && s.charges);
    const target = potion && demoItemTargets(catalog, state, potion.instanceId).find(t => t.kind === "member" && danger.some(m => m.id === t.id));
    if (potion && target) return {type: "item", instanceId: potion.instanceId, target};
  }
  const attacks = options.filter(o => o.choice === "attack");
  const priority = (id: string | null) => {
    const e = enemy(id);
    if (strategy === "ignore-intents") return -e.hp; // Spread damage onto the healthiest enemy.
    return e.definitionId.endsWith(strategy === "chief-first" ? "reef-hook-chief" : "crossbowman") ? 0 : 1;
  };
  attacks.sort((a,b) => priority(a.targetId) - priority(b.targetId) || enemy(a.targetId).hp - enemy(b.targetId).hp);
  if (attacks[0]) return action(attacks[0]);
  if (strategy !== "ignore-intents") {
    const heal = options.find(o => o.choice === "heal");
    if (heal) return action(heal);
    const guard = options.find(o => o.choice === "guard" && enemy(o.targetId).damage > 0);
    if (guard) return action(guard);
  }
  if (battle.encounter.rerolls > 0 && battle.encounter.dice.some(d => !d.loaded && !d.spent && !d.sealed && battle.run.party.some(m => m.id === d.ownerId && m.hp > 0)))
    return {type: "battle", command: {type: "reroll"}};
  return {type: "battle", command: {type: "end-turn"}};
}

export function g1ReachBoss(r: G1Recorder) {
  for (let i = 0; i < 150 && r.state.run.room !== 3; i++) {
    const op = tutorialNextOperation(r.catalog, r.state, "tactical");
    requireG1(op, "Could not reach Boss"); r.step(op, "T3.free");
  }
  requireG1(r.state.run.room === 3 && r.state.encounter?.round === 1, "Boss start not reached");
}

export function g1FinishBoss(r: G1Recorder, strategy: G1BossStrategy) {
  const start = r.trace.length, eventStart = r.events.length;
  let maxRound = 1;
  for (let i = 0; i < 350; i++) {
    maxRound = Math.max(maxRound, r.state.encounter?.round ?? 1);
    if (r.state.tutorial?.story) { r.read("return.read"); continue; }
    const op = g1FreeOperation(r.catalog, r.state, strategy);
    if (!op) break;
    r.step(op, `Boss.${strategy}`);
  }
  requireG1(["failed", "claimable"].includes(r.state.tutorial!.stage), "Boss policy stalled");
  const events = r.events.slice(eventStart);
  return {strategy, won: r.state.tutorial!.stage === "claimable", rounds: maxRound,
    damage: events.filter(e => e.type === "damage-applied" && g1Payload(e).targetKind === "party-member").reduce((n,e) => n + Number(g1Payload(e).applied), 0),
    downed: events.filter(e => e.type === "unit-downed").map(e => e.actorId),
    guards: events.filter(e => e.type === "guard-applied").length,
    final: g1Snapshot(r.state), terminal: r.state.result, trace: r.trace.slice(start),
  };
}

/** Unpublished lab catalog: retain the legal five-layer manor shell, replace its first two rooms only.
 * No production catalog, save, route registration or tutorial policy is changed.
 */
export function g1EventCatalog(base: D5Catalog) {
  const data = structuredClone(base), j = data.journey!;
  requireG1(data.contentVersion === 6, "Event laboratory requires the pre-tutorial content-6 base");
  const rooms = data.routes[data.manor!.firstClearRouteId].layers[0];
  data.enemies["enemy.g1.slime"] = {id: "enemy.g1.slime", hp: 3, attack: 1, bounty: 0, behavior: "attack"};
  data.encounters["encounter.g1.entry"] = {id: "encounter.g1.entry", enemyIds: ["enemy.g1.slime", "enemy.g1.slime"]};
  j.rooms[rooms[0]] = {id: rooms[0], kind: "battle", encounterId: "encounter.g1.entry", sceneId: "scene.g1.lab"};
  j.events["event.g1.tide-cache"] = {id: "event.g1.tide-cache", kind: "relic", cost: 0, reward: 0, name: "潮坑落货 · G1独立样本", text: "选择一名队员检查硬皮包；无费用、无奖励。"};
  j.rooms[rooms[1]] = {id: rooms[1], kind: "event", eventId: "event.g1.tide-cache", sceneId: "scene.g1.lab"};
  return validateD5Catalog(data);
}

export function g1ReachEvent(catalog: ValidatedD5Catalog, seed: number) {
  const r = new G1Recorder(catalog, seed, true, true);
  for (let i = 0; i < 150 && r.state.node !== "room-complete"; i++) {
    const op = g1FreeOperation(catalog, r.state, "crossbow-first");
    requireG1(op, "Could not finish event-entry battle"); r.step(op, "E1.fixture-entry");
  }
  requireG1(r.state.node === "room-complete", "Event-entry battle stalled");
  r.advance("E1.enter");
  requireG1(g1Snapshot(r.state).node === "event" && r.state.run.eventRng.cursor === 0, "E1 not waiting on its first draw");
  return r;
}
