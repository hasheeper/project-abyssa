import type { CharacterDef, CharacterId } from "../domain/state";

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  kael: {
    id: "kael",
    name: "凯尔",
    faces: [
      { verb: "attack", power: 1, pip: 1, label: "制服", quality: "plain" },
      { verb: "attack", power: 1, pip: 2, label: "截击", quality: "plain" },
      { verb: "guard", power: 1, pip: 3, label: "招架", quality: "plain" },
      { verb: "guard", power: 1, pip: 4, label: "护卫", quality: "plain" },
      { verb: "heal", power: 1, pip: 5, label: "包扎", quality: "plain" },
      {
        verb: "wild",
        power: 1,
        pip: 6,
        wildPip: true,
        label: "静谧之楔",
        quality: "gild"
      }
    ]
  },
  eustice: {
    id: "eustice",
    name: "尤斯缇丝",
    faces: [
      { verb: "attack", power: 1, pip: 1, label: "剑击", quality: "plain" },
      { verb: "attack", power: 2, pip: 2, label: "剑击", quality: "plain" },
      { verb: "attack", power: 2, pip: 3, label: "剑击", quality: "plain" },
      { verb: "attack", power: 3, pip: 4, label: "红莲突刺", quality: "gild" },
      { verb: "guard", power: 2, pip: 5, label: "王权结阵", quality: "plain" },
      { verb: "blank", power: 0, pip: 6, label: "气急败坏", quality: "plain" }
    ]
  },
  elora: {
    id: "elora",
    name: "艾洛拉",
    faces: [
      { verb: "heal", power: 1, pip: 1, label: "圣光", quality: "plain" },
      { verb: "guard", power: 1, pip: 2, label: "圣杖防卫", quality: "plain" },
      { verb: "heal", power: 1, pip: 3, label: "圣光", quality: "plain" },
      { verb: "heal", power: 1, pip: 4, label: "圣光", quality: "plain" },
      {
        verb: "heal",
        power: 2,
        pip: 5,
        label: "越限奇迹",
        effectDefinitionIds: ["action.expensive-heal"],
        quality: "gild"
      },
      { verb: "blank", power: 0, pip: 6, label: "心疼发呆", quality: "plain" }
    ]
  },
  kororo: {
    id: "kororo",
    name: "柯萝萝",
    faces: [
      { verb: "attack", power: 4, pip: 1, label: "渊星重压", quality: "plain" },
      { verb: "attack", power: 4, pip: 2, label: "渊星重压", quality: "plain" },
      { verb: "attack", power: 5, pip: 3, label: "微缩极星", quality: "gild" },
      { verb: "blank", power: 0, pip: 4, label: "摆烂", quality: "plain" },
      { verb: "blank", power: 0, pip: 5, label: "摆烂", quality: "plain" },
      { verb: "blank", power: 0, pip: 6, label: "不要——", quality: "plain" }
    ]
  },
  norma: {
    id: "norma",
    name: "诺玛",
    faces: [
      { verb: "coin", power: 1, pip: 1, label: "顺手牵羊", quality: "plain" },
      { verb: "coin", power: 2, pip: 2, label: "顺手牵羊", quality: "rust" },
      { verb: "attack", power: 2, pip: 3, label: "毒刀", quality: "plain" },
      { verb: "guard", power: 1, pip: 4, label: "拆解机关", quality: "plain" },
      { verb: "guard", power: 2, pip: 5, label: "无音步", quality: "plain" },
      { verb: "blank", power: 0, pip: 6, label: "咬碎糖", quality: "plain" }
    ]
  }
};

export const PARTY_ORDER: readonly CharacterId[] = [
  "kael",
  "eustice",
  "elora",
  "kororo",
  "norma"
];
