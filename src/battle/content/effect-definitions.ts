import type {
  ActionEffectDefinitionRegistry,
  BattleEffectDefinitionRegistry,
  ReactionRegistry
} from "../domain/effects";

export const EXPENSIVE_HEAL_EFFECT_ID = "action.expensive-heal";
export const FRENZY_WARNING_STATUS_ID = "status.frenzy-warning";
export const FRENZY_ACTIVE_STATUS_ID = "status.frenzy-active";

export const ACTION_EFFECT_DEFINITIONS: ActionEffectDefinitionRegistry = {
  [EXPENSIVE_HEAL_EFFECT_ID]: {
    definitionId: EXPENSIVE_HEAL_EFFECT_ID,
    trigger: "heal",
    effect: {
      type: "resource-cost",
      resource: "gold",
      amount: 10,
      reason: "healing-cost",
      log: "越限奇迹消耗了价值 10G 的治疗材料。",
      fact: "艾洛拉为了治疗同伴再次使用了昂贵材料，事后大概会心疼账单。"
    }
  }
};

export const BATTLE_EFFECT_DEFINITIONS: BattleEffectDefinitionRegistry = {
  [EXPENSIVE_HEAL_EFFECT_ID]: {
    definitionId: EXPENSIVE_HEAL_EFFECT_ID,
    modifiers: [],
    reactions: []
  },
  [FRENZY_WARNING_STATUS_ID]: {
    definitionId: FRENZY_WARNING_STATUS_ID,
    modifiers: [],
    reactions: []
  },
  [FRENZY_ACTIVE_STATUS_ID]: {
    definitionId: FRENZY_ACTIVE_STATUS_ID,
    modifiers: [],
    reactions: []
  }
};

/** Handler functions stay in code; only their ids are serialized by instances. */
export const BATTLE_REACTION_REGISTRY: ReactionRegistry = {};
