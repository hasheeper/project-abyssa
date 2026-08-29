import {
  DOWNED_RETURN_HP,
  LAYER_MULTIPLIERS,
  MAX_HP,
  REROLLS_PER_ROUND
} from "../content/balance";
import { CHARACTERS, PARTY_ORDER } from "../content/characters";
import { createLayerEnemies } from "../content/enemies";
import type { BattleTransition } from "../domain/commands";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type { BattleEvent } from "../domain/events";
import type {
  BattleStartInput,
  ExpeditionState,
  Rng
} from "../domain/state";
import { createBattleRngState } from "../persistence/rng";
import { resolveAtomicEffects } from "./resolver";
import { beginNextRoundTransition } from "./turns";
import { cloneBattleLoadout, createEmptyBattleLoadout } from "./loadout";

function base(
  state: ExpeditionState,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `layer:${state.eventSequence}:${state.layer + 1}`;
  return {
    id: `${batchId}:${suffix}`,
    source: { kind: "system", id: "layer" },
    causeId: batchId,
    batchId,
    tags
  };
}

function mergeEvents(...groups: readonly BattleEvent[][]): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const group of groups) {
    for (const event of group) {
      events.push({ ...event, sequence: events.length } as BattleEvent);
    }
  }
  return events;
}

function createInitialState(
  location: string,
  loadout = createEmptyBattleLoadout()
): ExpeditionState {
  const loadoutAtStart = cloneBattleLoadout(loadout);
  return {
    location,
    layer: 1,
    deepestLayer: 1,
    round: 0,
    layerStartEnemies: 0,
    lastTossed: [],
    stalledRounds: 0,
    lastEnemyHp: 0,
    gold: 0,
    bagGold: 0,
    handMultiplier: 0,
    lastLayerSettlement: null,
    mode: { type: "awaiting-roll" },
    rerollsRemaining: REROLLS_PER_ROUND,
    enemySequence: 0,
    party: PARTY_ORDER.map((id) => ({
      id,
      hp: MAX_HP,
      shield: 0,
      downed: false,
      rustLevel: 0,
      sealedNext: false
    })),
    dice: [],
    enemies: [],
    rng: createBattleRngState(0),
    pendingEffects: [],
    pendingReactions: [],
    statuses: [],
    encounterRules: [],
    loadoutAtStart,
    loadout: cloneBattleLoadout(loadoutAtStart),
    eventSequence: 0,
    undoStack: [],
    log: [],
    facts: [],
    result: null
  };
}

/** Enter one layer, revive exhausted members, and publish its opening intents. */
export function startLayerTransition(
  state: ExpeditionState,
  layer: number,
  rng: Rng,
  announce = true
): BattleTransition {
  let enemySequence = state.enemySequence;
  const enemies = createLayerEnemies(layer, () => {
    enemySequence += 1;
    return enemySequence;
  }, rng);
  const effects: AtomicEffect[] = [
    {
      ...base(state, "start", ["layer"]),
      type: "start-layer",
      layer,
      deepestLayer: Math.max(state.deepestLayer, layer),
      enemies,
      enemySequence
    },
    {
      ...base(state, "entry-log"),
      type: "append-log",
      tone: "gold",
      text: `进入第 ${layer} 层，收益倍率 ×${LAYER_MULTIPLIERS[layer - 1]}。`
    }
  ];
  for (const member of state.party) {
    if (!member.downed) continue;
    effects.push(
      {
        ...base(state, `revive:${member.id}`, ["layer", "revive"]),
        source: { kind: "character", id: member.id },
        type: "revive",
        target: { kind: "party-member", id: member.id },
        hp: DOWNED_RETURN_HP
      },
      {
        ...base(state, `revive-log:${member.id}`),
        source: { kind: "character", id: member.id },
        type: "append-log",
        tone: "system",
        text: `${CHARACTERS[member.id].name}在新一层完成重整，以 ${DOWNED_RETURN_HP}/${MAX_HP} 生命归队；命数锈蚀仍然保留。`
      }
    );
  }
  if (announce) {
    effects.push({
      ...base(state, "announce"),
      type: "announce-layer-started",
      layer,
      round: 1
    });
  }

  const entered = resolveAtomicEffects(state, effects);
  if (entered.error) {
    return { state, events: [], error: "command-not-available" };
  }
  const round = beginNextRoundTransition(entered.state, rng);
  if (round.error) return { state, events: [], error: round.error };
  return {
    state: round.state,
    events: mergeEvents(entered.events, round.events),
    error: null
  };
}

export function createExpeditionTransition(
  rng: Rng,
  location = "混沌领域",
  loadout = createEmptyBattleLoadout()
): BattleTransition {
  const state = createInitialState(location, loadout);
  return startLayerTransition(state, 1, rng, false);
}

export function createExpeditionState(
  rng: Rng,
  location = "混沌领域",
  loadout = createEmptyBattleLoadout()
): ExpeditionState {
  const transition = createExpeditionTransition(rng, location, loadout);
  transition.state.eventSequence = 0;
  return transition.state;
}

export function createExpeditionStateFromInput(
  rng: Rng,
  input: BattleStartInput = {}
): ExpeditionState {
  return createExpeditionState(
    rng,
    input.location ?? "混沌领域",
    input.loadout ?? createEmptyBattleLoadout()
  );
}

export function goDeeperTransition(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  if (state.mode.type !== "greed") {
    return { state, events: [], error: "command-not-available" };
  }
  return startLayerTransition(state, state.layer + 1, rng, true);
}
