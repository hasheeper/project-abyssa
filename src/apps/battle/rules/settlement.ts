import {
  LAYER_MULTIPLIERS,
  MAX_HP,
  MAX_LAYER
} from "../content/balance";
import type { BattleTransition } from "../domain/commands";
import type { AtomicEffect, AtomicEffectBase } from "../domain/effects";
import type {
  ExpeditionResult,
  ExpeditionState,
  HandEvaluation,
  LayerSettlement,
  Rng
} from "../domain/state";
import { getLayerPayout } from "./economy";
import { resolveAtomicEffects } from "./resolver";
import { isEnemyDefeated } from "../selectors/battle-selectors";

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function base(
  state: ExpeditionState,
  suffix: string,
  tags: string[] = []
): AtomicEffectBase {
  const batchId = `settlement:${state.eventSequence}:${state.layer}:${state.round}`;
  return {
    id: `${batchId}:${suffix}`,
    source: { kind: "system", id: "settlement" },
    causeId: batchId,
    batchId,
    tags
  };
}

function logEffect(
  state: ExpeditionState,
  suffix: string,
  tone: Extract<AtomicEffect, { type: "append-log" }>["tone"],
  text: string
): AtomicEffect {
  return { ...base(state, suffix), type: "append-log", tone, text };
}

function factEffect(
  state: ExpeditionState,
  suffix: string,
  text: string
): AtomicEffect {
  return { ...base(state, suffix), type: "append-fact", text };
}

function resourceEffect(
  state: ExpeditionState,
  suffix: string,
  resource: Extract<AtomicEffect, { type: "modify-resource" }>["resource"],
  value: number
): AtomicEffect {
  return {
    ...base(state, suffix, ["settlement"]),
    type: "modify-resource",
    resource,
    operation: "set",
    value,
    reason: "settlement"
  };
}

export function getLayerSettlement(
  state: ExpeditionState,
  closingHand: HandEvaluation | null = null
): LayerSettlement {
  const handFactor = roundTwo(1 + state.handMultiplier);
  const layerFactor = LAYER_MULTIPLIERS[state.layer - 1] ?? LAYER_MULTIPLIERS[4];
  const payout = getLayerPayout(state);
  return {
    layer: state.layer,
    round: state.round,
    baseGold: state.gold,
    handFactor,
    layerFactor,
    payout,
    bagBefore: state.bagGold,
    bagAfter: state.bagGold + payout,
    closingHandName: closingHand?.name ?? null,
    closingHandBonus: closingHand?.adjustedBonus ?? 0
  };
}

function bankLayerEffects(
  state: ExpeditionState,
  closingHand: HandEvaluation | null
): { settlement: LayerSettlement; effects: AtomicEffect[] } {
  const settlement = getLayerSettlement(state, closingHand);
  const effects: AtomicEffect[] = [
    {
      ...base(state, "record-layer", ["settlement"]),
      type: "record-layer-settlement",
      settlement
    }
  ];
  if (state.gold > 0 || state.handMultiplier > 0) {
    effects.push(
      logEffect(
        state,
        "bank-log",
        "gold",
        `第 ${state.layer} 层入袋：${state.gold}G × 牌型 ${settlement.handFactor.toFixed(2)}` +
          ` × 层倍率 ${settlement.layerFactor} ＝ ${settlement.payout}G，存入包裹。`
      )
    );
  }
  if (state.bagGold !== settlement.bagAfter) {
    effects.push(resourceEffect(state, "bank-bag", "bag-gold", settlement.bagAfter));
  }
  if (state.gold !== 0) {
    effects.push(resourceEffect(state, "clear-loose-gold", "gold", 0));
  }
  if (state.handMultiplier !== 0) {
    effects.push(resourceEffect(state, "clear-hand-multiplier", "hand-multiplier", 0));
  }
  return { settlement, effects };
}

function finishEffect(
  state: ExpeditionState,
  result: ExpeditionResult,
  announce: boolean
): AtomicEffect {
  return {
    ...base(state, "finish-expedition"),
    type: "finish-expedition",
    result,
    announce
  };
}

function finishResult(
  state: ExpeditionState,
  fields: Pick<ExpeditionResult, "wiped" | "baseGold" | "multiplier" | "totalGold">,
  rng: Rng
): { result: ExpeditionResult; crystalFact: AtomicEffect | null } {
  let crystal = false;
  if (!fields.wiped && state.deepestLayer >= 3) {
    crystal = rng() < 0.25 * (state.deepestLayer - 2);
  }
  return {
    result: {
      ...fields,
      deepestLayer: state.deepestLayer,
      crystal
    },
    crystalFact: crystal
      ? factEffect(
          state,
          "crystal-fact",
          `从第 ${state.deepestLayer} 层带回了一枚远古晶石。`
        )
      : null
  };
}

/** Settle a completed enemy turn after frenzy recoil has already resolved. */
export function settleEnemyTurnTransition(
  state: ExpeditionState,
  rng: Rng,
  closingHand: HandEvaluation | null
): BattleTransition {
  if (state.mode.type !== "enemy-turn") {
    return { state, events: [], error: "command-not-available" };
  }
  const activeParty = state.party.filter((member) => !member.downed);
  const activeEnemies = state.enemies.filter((enemy) => !isEnemyDefeated(enemy));
  const effects: AtomicEffect[] = [];

  if (activeParty.length === 0) {
    const multiplier = roundTwo(1 + state.handMultiplier);
    const baseGold = state.bagGold;
    const lost = Math.round(state.bagGold * 0.5);
    const totalGold = state.bagGold - lost;
    effects.push(
      factEffect(
        state,
        "wipe-fact",
        "全员带伤撤离，凯尔回去后恐怕要面对整桌人的说教。"
      )
    );
    if (state.bagGold !== totalGold) {
      effects.push(resourceEffect(state, "wipe-bag", "bag-gold", totalGold));
    }
    if (state.gold !== 0) effects.push(resourceEffect(state, "wipe-gold", "gold", 0));
    if (state.handMultiplier !== 0) {
      effects.push(resourceEffect(state, "wipe-hand", "hand-multiplier", 0));
    }
    effects.push(
      logEffect(
        state,
        "wipe-log",
        "bad",
        `全员力竭：第 ${state.layer} 层收益全部丢失，包裹损失 ${lost}G。`
      )
    );
    if (lost > 0) {
      effects.push(
        factEffect(state, "lost-bag-fact", "撤离时慌乱中散落了半个包裹的战利品。")
      );
    }
    const { result } = finishResult(
      state,
      { wiped: true, baseGold, multiplier, totalGold },
      rng
    );
    effects.push(
      finishEffect(state, result, false),
      {
        ...base(state, "wipe-outcome"),
        type: "finalize-round",
        outcome: "wipe",
        settlement: null
      }
    );
  } else if (activeEnemies.length === 0) {
    effects.push(
      logEffect(state, "layer-cleared-log", "gold", `第 ${state.layer} 层完成肃清。`)
    );
    const anyoneHurt = state.party.some(
      (member) => member.downed || member.hp < MAX_HP
    );
    if (!anyoneHurt && state.round <= 2) {
      effects.push(
        factEffect(
          state,
          "quick-clear-fact",
          `第 ${state.layer} 层以零伤快速肃清。`
        )
      );
    }
    const banked = bankLayerEffects(state, closingHand);
    effects.push(...banked.effects);

    if (state.layer >= MAX_LAYER) {
      effects.push(
        logEffect(
          state,
          "leave-log",
          "gold",
          `带宝离场：包裹合计 ${banked.settlement.bagAfter}G。`
        )
      );
      const { result, crystalFact } = finishResult(
        state,
        {
          wiped: false,
          baseGold: banked.settlement.bagAfter,
          multiplier: 1,
          totalGold: banked.settlement.bagAfter
        },
        rng
      );
      if (crystalFact) effects.push(crystalFact);
      effects.push(finishEffect(state, result, false));
    } else {
      effects.push({ ...base(state, "enter-greed"), type: "enter-greed" });
    }
    effects.push({
      ...base(state, "layer-outcome"),
      type: "finalize-round",
      outcome: "layer-cleared",
      settlement: banked.settlement
    });
  } else {
    effects.push({
      ...base(state, "continue-outcome"),
      type: "finalize-round",
      outcome: "continue",
      settlement: null
    });
  }

  const resolved = resolveAtomicEffects(state, effects);
  return resolved.error
    ? { state, events: [], error: "command-not-available" }
    : { state: resolved.state, events: resolved.events, error: null };
}

/** Finish voluntarily from greed, including any still-pending current-layer payout. */
export function leaveExpeditionTransition(
  state: ExpeditionState,
  rng: Rng
): BattleTransition {
  if (state.mode.type !== "greed") {
    return { state, events: [], error: "command-not-available" };
  }
  const multiplier = roundTwo(1 + state.handMultiplier);
  const baseGold = state.bagGold;
  const pendingPayout = getLayerPayout(state);
  const effects: AtomicEffect[] = [];
  let totalGold = state.bagGold;
  if (pendingPayout > 0) {
    const banked = bankLayerEffects(state, null);
    effects.push(...banked.effects);
    totalGold = banked.settlement.bagAfter;
  }
  effects.push(
    logEffect(
      state,
      "leave-log",
      "gold",
      `带宝离场：包裹合计 ${totalGold}G。`
    )
  );
  const { result, crystalFact } = finishResult(
    state,
    { wiped: false, baseGold, multiplier, totalGold },
    rng
  );
  if (crystalFact) effects.push(crystalFact);
  effects.push(finishEffect(state, result, true));

  const resolved = resolveAtomicEffects(state, effects);
  return resolved.error
    ? { state, events: [], error: "command-not-available" }
    : { state: resolved.state, events: resolved.events, error: null };
}
