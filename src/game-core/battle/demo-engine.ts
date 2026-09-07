import type { RuleContext, RuleBattleState, RuleResolution } from "./domain/rule-state";
import { releaseMemoryDefenders, memorySupplyId, memoryProtection, predictEnemyDamage } from "./rules/v4/memory";
import { planBossFormation } from "./rules/v4/formation";
import { demoIntentPower, releaseManorGuests } from "./rules/v3/manor";
import type { DemoProgress, ValidatedDemoCatalog } from "../contracts/demo";
import { demoEncounterId } from "../contracts/demo-journey-validation";
import * as v from "../contracts/validation";
import type { DemoEncounterState, DemoEnemy } from "./domain/demo-state";
import { createBattleRngState } from "./persistence/rng";
import {
  resolveDemoParty,
  validateDemoProgress,
} from "./rules/v2/configuration";
import { demoFace, evaluateDemoHand } from "./rules/v2/hand";
import {
  demoActionOptions,
  emit,
  finishEncounter,
  performDemoAction,
  randomInt,
  type DemoResolution,
} from "./rules/v2/combat";
import { resolveDemoCovenants } from "./rules/v2/covenants";
import { beginDemoRound, resolveDemoEnemy } from "./rules/v2/lifecycle";
import {
  parseDemoBattleCommand,
  validateDemoBattleState,
} from "./rules/v2/validation";

export type DemoBattleStart = {
  runId: string;
  routeId: string;
  partyIds: string[];
  progress: DemoProgress;
  seed: number;
};
function encounter(
  catalog: RuleContext,
  state: RuleBattleState,
): DemoEncounterState {
  const run = state.run,
    id = `${run.id}:encounter:${run.encounterSequence}`;
  const definitionId =
    demoEncounterId(catalog.data, run.routeId, run.layer, run.room);
  const initial = catalog.data.encounters[definitionId].enemyIds;
  const memory = catalog.data.rulesVersion === 4 && definitionId === catalog.data.combat.memory.encounterId ? catalog.data.combat.memory : null;
  const hasBoss = initial.includes(catalog.data.manor?.boss.definitionId ?? "");
  const enemies: DemoEnemy[] = initial.map(
    (definitionId, i) => ({
      id: `${id}:enemy:${i + 1}`,
      definitionId,
      hp: catalog.data.enemies[definitionId].hp,
      chargeReady: false,
      threaded: false,
      escaped: false,
      boundRound: null,
      intent: null,
      ...(catalog.ref.rulesVersion >= 3 ? {disposition: "active" as const, origin: {kind: "initial" as const, serial: i + 1, bornRound: 0, summonerId: null, seat: hasBoss && definitionId === catalog.data.manor!.boss.guestId}} : {}),
    }),
  );
  return {
    id,
    definitionId,
    round: 0,
    phase: "roll",
    outcome: null,
    dice: [],
    enemies,
    formation: enemies.map((e) => e.id),
    enemyOrder: [],
    cursor: 0,
    hand: null,
    rerolls: 2,
    guardBonusIds: [], itemsUsed: 0, extraRerolls: 0,
    ...(catalog.ref.rulesVersion >= 3 && !memory ? {manor: {summoned: 0, released: false}} : {}),
    ...(memory ? {memory: {bossId: enemies[0].id, puppetId: memory.puppetId, defeated: false, released: false}} : {}),
  };
}
/** Versioned Demo rules. No persistence, presentation or default content is selected here. */
export function createDemoBattleEngine(catalog: ValidatedDemoCatalog) {
  v.choice(catalog.ref.rulesVersion, [2, 3], "rulesVersion");
  return createRuleBattleEngine(catalog, raw => validateDemoBattleState(catalog, raw));
}
/** Shared implementation with an explicit version-bound reader; never rewrites a content reference. */
export function createRuleBattleEngine<S extends RuleBattleState>(catalog: RuleContext, restore: (raw: unknown) => S) {
  return {
    contentRef: catalog.ref,
    restore,
    create(raw: unknown): S {
      v.assertJson(raw);
      const r = v.record(raw, "start", [
        "runId",
        "routeId",
        "partyIds",
        "progress",
        "seed",
      ]);
      const runId = v.id(r.runId, "runId"),
        routeId = v.id(r.routeId, "routeId");
      v.reference(catalog.data.routes, routeId, "routeId");
      const progress = validateDemoProgress(catalog.data, r.progress),
        partyIds = v.ids(r.partyIds, "partyIds", 5);
      const config = resolveDemoParty(catalog.data, progress, partyIds);
      const seed = v.number(r.seed, "seed", 0, 0xffffffff);
      const run: RuleBattleState["run"] = {
        id: runId,
        routeId,
        contentRef: { ...catalog.ref },
        progress,
        party: config.members.map((m) => ({
          id: m.id,
          config: m,
          hp: m.maxHp,
          temporaryRust: [],
          pendingSeal: false,
          rainyReturn: false,
        })),
        layer: 1,
        room: 0,
        encounterSequence: 1,
        looseGold: 0,
        handBonus: 0,
        bankedGold: 0,
        completedEncounterIds: [],
        settledLayers: [],
        rng: createBattleRngState(seed),
        sequence: 0,
        roomIds: catalog.data.routes[routeId].layers.map((rooms, l) => rooms.map((_, r) => `${runId}:room:${l + 1}:${r + 1}`)),
        completedRoomIds: [], supplies: [], foodUses: {}, layerResults: [], eventResults: [], revealed: [],
        eventRng: createBattleRngState((seed ^ 0x3c6ef372) >>> 0).combat,
      };
      if (catalog.data.rulesVersion === 4 && routeId === catalog.data.combat.memory.routeId) run.supplies = catalog.data.progression.chapter.supplies.map(s => ({...s, instanceId: memorySupplyId(runId, s.definitionId), source: "memory.marietta.allowance"}));
      const state = {
        run,
        encounter: null,
        undo: [],
      } as unknown as RuleBattleState;
      state.encounter = encounter(catalog, state);
      const ctx = { state, events: [] };
      beginDemoRound(catalog.data, ctx);
      return restore(ctx.state);
    },
    dispatch(input: S, raw: unknown): {state: S; events: DemoResolution["events"]} {
      const state = restore(input),
        command = parseDemoBattleCommand(raw),
        enc = state.encounter;
      const ctx: RuleResolution = { state, events: [] };
      if (command.type === "undo") {
        if (enc.phase !== "act" || !enc.formation.length || enc.memory?.defeated || !state.undo.length)
          v.invalid("undo", "Nothing to undo", "command-not-available");
        const cp = state.undo.pop()!,
          sequence = state.run.sequence;
        state.run = cp.run;
        state.encounter = cp.encounter;
        state.run.sequence = sequence;
        emit(ctx, "action-undone", null, {});
        return { state: restore(state), events: ctx.events };
      }
      const acting = ["reroll", "toggle-load", "act"].includes(command.type);
      if (acting && (enc.phase !== "act" || !enc.formation.length || enc.memory?.defeated))
        v.invalid("phase", "Player input is closed", "command-not-available");
      if (acting)
        state.undo.push({
          run: structuredClone(state.run),
          encounter: structuredClone(enc),
        });
      switch (command.type) {
        case "roll":
        case "reroll": {
          if (command.type === "roll" && enc.phase !== "roll")
            v.invalid("phase", "Already rolled", "command-not-available");
          const eligible = enc.dice.filter(
            (d) =>
              !d.sealed &&
              !d.spent &&
              !d.loaded &&
              state.run.party.find((m) => m.id === d.ownerId)!.hp > 0,
          );
          if (command.type === "reroll" && (!enc.rerolls || !eligible.length))
            v.invalid("reroll", "No reroll available", "command-not-available");
          for (const d of eligible) d.faceIndex = randomInt(state, 0, 5);
          enc.phase = "act";
          if (command.type === "reroll") enc.rerolls--;
          if (catalog.ref.rulesVersion === 4) state.undo = [];
          emit(ctx, "dice-rolled", null, {
            ownerIds: eligible.map((d) => d.ownerId),
            reroll: command.type === "reroll",
          });
          break;
        }
        case "toggle-load": {
          const d = enc.dice.find((d) => d.ownerId === command.actorId),
            m = state.run.party.find((m) => m.id === command.actorId);
          if (
            !d ||
            !m ||
            m.hp <= 0 ||
            d.sealed ||
            d.spent ||
            d.faceIndex === null
          )
            v.invalid("die", "Cannot toggle this die", "command-not-available");
          d.loaded = !d.loaded;
          emit(ctx, "die-fixed", command.actorId, { loaded: d.loaded });
          break;
        }
        case "act":
          performDemoAction(
            catalog.data,
            ctx,
            command.actorId,
            command.choice,
            command.targetId,
          );
          releaseManorGuests(catalog.data, ctx);
          break;
        case "end-turn": {
          if (enc.phase !== "act")
            v.invalid("phase", "Not a player turn", "command-not-available");
          state.undo = [];
          enc.hand = evaluateDemoHand(catalog.data, state);
          if (!enc.memory) state.run.handBonus =
            Math.round((state.run.handBonus + enc.hand.adjustedBonus) * 100) /
            100;
          enc.enemyOrder = enc.formation.filter(
            (id) => enc.enemies.find((e) => e.id === id)!.intent !== null,
          );
          enc.cursor = 0;
          enc.phase = "enemy";
          emit(ctx, "hand-settled", null, {
            name: enc.hand.name,
            bonus: enc.hand.adjustedBonus,
            wildValue: enc.hand.wildValue,
          });
          resolveDemoCovenants(catalog.data, ctx);
          releaseMemoryDefenders(ctx);
          finishEncounter(ctx);
          break;
        }
        case "resolve-next-enemy":
          resolveDemoEnemy(catalog.data, ctx);
          break;
        case "next-round":
          if (enc.phase !== "enemy" || enc.cursor !== enc.enemyOrder.length)
            v.invalid(
              "phase",
              "Enemy queue incomplete",
              "command-not-available",
            );
          state.undo = [];
          beginDemoRound(catalog.data, ctx);
          break;
      }
      return { state: restore(ctx.state), events: ctx.events };
    },
    select(raw: S) {
      const state = restore(raw);
      return {
        contentRef: catalog.ref,
        hand: evaluateDemoHand(catalog.data, state),
        phase: state.encounter.phase,
        party: state.run.party.map((m) => {
          const die = state.encounter.dice.find((d) => d.ownerId === m.id)!,
            face = demoFace(state, die);
          return {
            ...m,
            face,
            handEligible: m.hp > 0 && !die.sealed && face?.fate === "awake",
            actions: (() => { const offered = demoActionOptions(catalog.data, state, m.id);
              if (catalog.ref.rulesVersion !== 4) return offered;
              return {...offered, options: offered.options.map(o => {
                if (o.choice !== "attack" || !o.targetId) return o;
                const damage = predictEnemyDamage(state, o.targetId, o.amount), preview = structuredClone(state);
                const target = preview.encounter.enemies.find(e => e.id === o.targetId)!; target.hp -= damage.applied;
                if (!target.hp) { preview.encounter.formation = preview.encounter.formation.filter(id => id !== target.id); if (preview.encounter.memory?.bossId === target.id) preview.encounter.memory.defeated = true; }
                return {...o, damage, secondaryDamage: o.secondaryTargetId ? predictEnemyDamage(preview, o.secondaryTargetId, 1) : null};
              })}; })(),
          };
        }),
        enemies: state.encounter.formation.map((id) => {
          const e = state.encounter.enemies.find((e) => e.id === id)!;
          return {
            ...e,
            ...(catalog.ref.rulesVersion === 4 ? {protection: memoryProtection(state, e.id), reorderPreview: e.intent?.operation === "memory-reorder" ? planBossFormation(state, 2).after : null} : {}),
            intent: e.intent ? {...e.intent, value: demoIntentPower(state, e)} : null,
            damage:
              e.boundRound === state.encounter.round ||
              catalog.ref.rulesVersion >= 3 && !state.run.party.some(m => m.id === e.intent?.targetId && m.hp > 0) ||
              e.intent?.kind !== "attack"
                ? 0
                : Math.max(0, demoIntentPower(state, e) - e.intent.blocked),
          };
        }),
        canUndo:
          state.encounter.phase === "act" &&
          state.encounter.formation.length > 0 && !state.encounter.memory?.defeated &&
          state.undo.length > 0,
      };
    },
    startEncounter(run: S["run"]): {state: S; events: DemoResolution["events"]} {
      const state = { run: structuredClone(run), encounter: null, undo: [] } as unknown as RuleBattleState;
      for (const member of state.run.party) { if (!member.hp) member.hp = 1; member.pendingSeal = false; }
      state.encounter = encounter(catalog, state);
      const ctx: RuleResolution = { state, events: [] };
      beginDemoRound(catalog.data, ctx);
      emit(ctx, "encounter-started", null, { encounterId: state.encounter.id, layer: run.layer, room: run.room });
      return { state: restore(state), events: ctx.events };
    },
    /** Trusted session lifecycle primitive; reward/exit policy is a separate D3 responsibility. */
    continueRoute(raw: S): {state: S; events: DemoResolution["events"]} {
      const state = restore(raw);
      if (state.encounter.outcome !== "victory")
        v.invalid("encounter", "Victory required");
      const route = catalog.data.routes[state.run.routeId];
      let layer = state.run.layer,
        room = state.run.room + 1;
      if (room >= route.layers[layer - 1].length) {
        layer++;
        room = 0;
      }
      if (layer > route.layers.length)
        v.invalid("route", "Route complete", "route-complete");
      const newLayer = layer !== state.run.layer;
      for (const m of state.run.party) {
        if (m.hp === 0) m.hp = 1;
        if (newLayer && m.rainyReturn) {
          m.hp = Math.max(m.hp, Math.min(2, m.config.maxHp));
          m.rainyReturn = false;
        }
        m.pendingSeal = false;
      }
      state.run.layer = layer;
      state.run.room = room;
      state.run.encounterSequence++;
      state.undo = [];
      state.encounter = encounter(catalog, state);
      const ctx: RuleResolution = { state, events: [] };
      beginDemoRound(catalog.data, ctx);
      emit(ctx, "encounter-started", null, {
        encounterId: state.encounter.id,
        layer,
        room,
      });
      return { state: restore(state), events: ctx.events };
    },
    /** Primitive for D5; deliberately absent from public player commands. */
    reorder(raw: S, formation: string[]): S {
      const state = restore(raw);
      state.encounter.formation = [...formation];
      return restore(state);
    },
  };
}
