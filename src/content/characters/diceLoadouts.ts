import type { CharacterDiceLoadout } from "../../shared/domain/dice/face";

/* 骰装数据。
   ------------------------------------------------------------------
   本期只做两人完整数据（蕾诺尔、艾比希斯），其余七人是占位。
   占位不是「缺数据」而是一种正当状态：战斗引擎目前只认五人
   （src/apps/battle/domain/state.ts:35 的 CharacterId），
   档案九人里有五人一面骰都没有。骰装页对这些人显示「未编入远征」，
   而不是渲染一副假骰子。

   花色分配遵循设计铁律：主色 4 面、副色 2 面，按角色出身。
   diceLoadouts.test.ts 会逐人校验这个 4/2 配比。 */

export const characterDiceLoadouts: CharacterDiceLoadout[] = [
  /* 蕾诺尔·伏尼契 —— 彼岸主 / 尘世副。
     四天王走淬火线：沉眠的骰角一格格刻回点数。她还剩两面沉眠。 */
  {
    characterId: "lenore",
    primarySuit: "beyond",
    secondarySuit: "earth",
    pact: "【阿卡夏之锁】两对成型时，捆住一枚敌方意图延迟一回合",
    faces: [
      {
        face: 1,
        pip: 1,
        action: "attack",
        power: 2,
        fate: "asleep",
        suit: "beyond"
      },
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
        note: "她极少施疗，出手时不容病人乱动"
      },
      {
        face: 4,
        pip: 4,
        action: "attack",
        power: 3,
        fate: "asleep",
        suit: "beyond"
      },
      {
        face: 5,
        pip: 5,
        action: "guard",
        power: 3,
        basePower: 2,
        chamedBy: "page-of-binding",
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
        id: "page-of-binding",
        name: "缚灵书页",
        secondaryName: "PAGE OF BINDING",
        kind: "combat-face",
        icon: "scroll",
        effect: "第五面 格挡 2 提升至 3",
        origin: "守望者杂货铺 · 800 里拉",
        lore: "从她禁书库私自撕下的一页。本人尚未察觉。大概。"
      },
      {
        id: "faded-lunar-ring",
        name: "褪色月环坠",
        secondaryName: "FADED LUNAR RING",
        kind: "fate",
        icon: "ring",
        effect: "本骰参与葫芦成牌时，倍率 +0.2",
        origin: "珍品货架 · 远古晶石 2"
      }
    ]
  },

  /* 艾比希斯·贝尔泽兰 —— 渊影主 / 彼岸副。
     魔王战面超模（攻击 5），但命数刚够体面：三面沉眠不进牌局。 */
  {
    characterId: "abyssa",
    primarySuit: "abyss",
    secondarySuit: "beyond",
    pact: "【无冕之赦】三面沉眠同时朝上时，本回合免疫一次失手",
    faces: [
      {
        face: 1,
        pip: 1,
        action: "attack",
        power: 5,
        fate: "asleep",
        suit: "abyss"
      },
      {
        face: 2,
        pip: 2,
        action: "guard",
        power: 3,
        fate: "awake",
        suit: "abyss",
        note: "抵消 3 点来袭伤害"
      },
      {
        face: 3,
        pip: 3,
        action: "blank",
        power: 0,
        fate: "asleep",
        suit: "beyond"
      },
      {
        face: 4,
        pip: 4,
        action: "attack",
        power: 4,
        fate: "awake",
        suit: "abyss",
        note: "根源之力外溢，她自己也控不住准头"
      },
      {
        face: 5,
        pip: 5,
        action: "heal",
        power: 2,
        fate: "awake",
        suit: "beyond",
        note: "回复目标 2 心"
      },
      {
        face: 6,
        pip: 6,
        action: "guard",
        power: 2,
        fate: "asleep",
        suit: "abyss"
      }
    ],
    charms: [
      {
        id: "crownless-ring",
        name: "无冕冠环",
        secondaryName: "CROWNLESS CIRCLET",
        kind: "fate",
        icon: "ring",
        effect: "空面视作命数，不计战面",
        origin: "魔王城旧藏"
      }
    ]
  },

  /* 尤斯缇丝·格里芬 —— 圣辉主 / 尘世副。
     勇者小队走**鎏金线**，与四天王的淬火线正好相反：
     命数生来就醒着，修行方向是给签名面镀金、磨掉摆烂面的锈。
     所以她只有一面沉眠（气急败坏那面空面），其余五面尽醒 ——
     战面数值普通（攻 1/2/2/3），但牌型稳定，这才是勇者的形状。
     六面数据取自战斗引擎 src/apps/battle/content/characters.ts:23-34，
     两边必须同序同值。 */
  {
    characterId: "eustice",
    primarySuit: "holy",
    secondarySuit: "earth",
    pact: "【王权领域】同花成型时，全队本回合格挡值 +1",
    faces: [
      {
        face: 1,
        pip: 1,
        action: "attack",
        power: 1,
        fate: "awake",
        suit: "holy",
        note: "基础剑击，她说这一下是给对手的礼貌"
      },
      {
        face: 2,
        pip: 2,
        action: "attack",
        power: 2,
        fate: "awake",
        suit: "holy",
        note: "造成 2 点伤害"
      },
      {
        face: 3,
        pip: 3,
        action: "attack",
        power: 2,
        fate: "awake",
        suit: "earth",
        note: "造成 2 点伤害"
      },
      {
        face: 4,
        pip: 4,
        action: "attack",
        power: 4,
        basePower: 3,
        chamedBy: "griffin-medal",
        fate: "awake",
        suit: "holy",
        note: "红莲突刺 · 签名面，已鎏金"
      },
      {
        face: 5,
        pip: 5,
        action: "guard",
        power: 2,
        fate: "awake",
        suit: "earth",
        note: "王权结阵，抵消 2 点来袭伤害"
      },
      {
        face: 6,
        pip: 6,
        action: "blank",
        power: 0,
        fate: "asleep",
        suit: "holy"
      }
    ],
    charms: [
      {
        id: "griffin-medal",
        name: "骑士领旧勋章",
        secondaryName: "OLD KNIGHT MEDAL",
        kind: "combat-face",
        icon: "attack",
        effect: "第四面 攻击 3 提升至 4",
        origin: "格里芬家族传承",
        lore: "军校首席毕业那天别上的。她从不提，但每次出征都戴着。"
      }
    ]
  },

  /* 以下六人尚未编入远征：没有骰面数据，骰装页走占位态。 */
  { characterId: "elora", faces: [], placeholderNote: "尚未编入远征队列" },
  { characterId: "kororo", faces: [], placeholderNote: "尚未编入远征队列" },
  { characterId: "norma", faces: [], placeholderNote: "尚未编入远征队列" },
  { characterId: "marietta", faces: [], placeholderNote: "尚未编入远征队列" },
  { characterId: "alvitr", faces: [], placeholderNote: "尚未编入远征队列" },
  { characterId: "vivienne", faces: [], placeholderNote: "尚未编入远征队列" }
];

export function findDiceLoadout(characterId: string): CharacterDiceLoadout | undefined {
  return characterDiceLoadouts.find((loadout) => loadout.characterId === characterId);
}
