import type { CharacterDiceLoadout } from "../domain/dice/face";

/* 骰装的最小 UI 夹具。
   ------------------------------------------------------------------
   shared 不许 import content(scripts/check-module-boundaries.mjs:72),
   所以组件测试不能直接取 characterProfiles 那套真实数据。
   这里只保留渲染分支所需的最小形状:
     一副完整骰(4 醒 2 眠、主色 4 副色 2、一面被挂坠改写、两件挂坠 + 一空位)
     一副空骰(占位态)
   真实名册的断言归 src/content/characters/diceLoadouts.test.ts。 */

export const diceLoadoutFixture: CharacterDiceLoadout = {
  characterId: "fixture-authored",
  primarySuit: "beyond",
  secondarySuit: "earth",
  pact: "【测试私约】两对成型时，捆住一枚敌方意图",
  faces: [
    { face: 1, pip: 1, action: "attack", power: 2, fate: "asleep", suit: "beyond" },
    {
      face: 2,
      pip: 2,
      action: "heal",
      power: 1,
      fate: "awake",
      suit: "earth",
      note: "回复目标 1 心"
    },
    {
      face: 3,
      pip: 3,
      action: "heal",
      power: 2,
      fate: "awake",
      suit: "beyond",
      note: "夹具风味说明"
    },
    { face: 4, pip: 4, action: "attack", power: 3, fate: "asleep", suit: "beyond" },
    {
      face: 5,
      pip: 5,
      action: "guard",
      power: 3,
      basePower: 2,
      chamedBy: "fixture-charm",
      fate: "awake",
      suit: "beyond",
      note: "卸下挂坠即还原"
    },
    {
      face: 6,
      pip: 6,
      action: "guard",
      power: 2,
      fate: "awake",
      suit: "earth",
      note: "抵消 2 点来袭伤害"
    }
  ],
  charms: [
    {
      id: "fixture-charm",
      name: "夹具书页",
      secondaryName: "FIXTURE PAGE",
      kind: "combat-face",
      icon: "scroll",
      effect: "第五面 格挡 2 提升至 3",
      origin: "夹具货架 · 800 里拉",
      lore: "夹具轶闻。"
    },
    {
      id: "fixture-ring",
      name: "夹具月环",
      secondaryName: "FIXTURE RING",
      kind: "fate",
      icon: "ring",
      effect: "本骰参与葫芦成牌时，倍率 +0.2"
    }
  ]
};

export const diceLoadoutPlaceholderFixture: CharacterDiceLoadout = {
  characterId: "fixture-empty",
  faces: [],
  placeholderNote: "尚未编入远征队列"
};
