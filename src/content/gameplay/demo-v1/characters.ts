import type {
  DemoContent,
  DemoFace,
  DemoSuit,
  DemoQuality,
  DemoActionKind,
} from "../../../game-core/contracts";

type Row = [string, string, number, boolean, DemoQuality, DemoSuit];
function faces(id: string, rows: Row[]): DemoFace[] {
  return rows.map(([name, action, power, awake, quality, suit], index) => ({
    id: `face.${id}.0${index + 1}`,
    slot: index + 1,
    name,
    pip:
      id === "kael" && index === 5
        ? { kind: "wild" }
        : { kind: "natural", value: index + 1 },
    fate: awake ? "awake" : "asleep",
    suit,
    quality,
    rust:
      quality !== "rust" ? "none" : id === "kael" ? "removable" : "permanent",
    actionId: `action.${action}`,
    power,
  }));
}
const character = (
  id: string,
  name: string,
  faction: "leader" | "hero" | "sovereign",
  suits: DemoSuit[],
  rows: Row[],
) => ({
  id,
  name,
  maxHp: 3,
  faction,
  suits,
  faces: faces(id, rows),
  covenantId: id === "kael" ? null : `covenant.${id}`,
});
export const DEMO_CHARACTERS: DemoContent["characters"] = {
  kael: character(
    "kael",
    "凯尔",
    "leader",
    ["light", "earth"],
    [
      ["制服", "attack", 1, true, "rust", "earth"],
      ["截击", "attack", 1, true, "plain", "earth"],
      ["招架", "guard", 1, true, "plain", "light"],
      ["护卫", "kael.protect", 2, true, "plain", "light"],
      ["包扎", "heal", 1, true, "plain", "light"],
      ["静谧之楔", "wild", 1, true, "gild", "light"],
    ],
  ),
  eustice: character(
    "eustice",
    "尤斯缇丝",
    "hero",
    ["light", "earth"],
    [
      ["剑击", "attack", 1, true, "plain", "light"],
      ["剑击", "attack", 2, true, "plain", "light"],
      ["定理剑术", "attack", 2, true, "plain", "earth"],
      ["红莲突刺", "attack", 3, true, "gild", "light"],
      ["王权结阵", "guard", 2, true, "plain", "earth"],
      ["气急败坏", "blank", 0, false, "plain", "light"],
    ],
  ),
  elora: character(
    "elora",
    "艾洛拉",
    "hero",
    ["earth", "light"],
    [
      ["圣光", "heal", 1, true, "plain", "earth"],
      ["圣杖防卫", "guard", 1, true, "plain", "earth"],
      ["圣光", "heal", 1, true, "plain", "earth"],
      ["心疼发呆", "blank", 0, false, "plain", "light"],
      ["圣杖回击", "attack", 2, true, "plain", "earth"],
      ["越限奇迹", "elora.expensive-heal", 2, true, "gild", "light"],
    ],
  ),
  kororo: character(
    "kororo",
    "柯萝萝",
    "hero",
    ["abyss", "beyond"],
    [
      ["摆烂", "blank", 0, false, "plain", "abyss"],
      ["摆烂", "blank", 0, false, "plain", "abyss"],
      ["不要——", "blank", 0, false, "plain", "beyond"],
      ["渊星重压", "attack", 4, true, "plain", "abyss"],
      ["渊星重压", "attack", 4, true, "plain", "abyss"],
      ["微缩极星", "attack", 5, true, "gild", "beyond"],
    ],
  ),
  norma: character(
    "norma",
    "诺玛",
    "hero",
    ["earth", "abyss"],
    [
      ["黑街百宝", "wild", 1, true, "plain", "earth"],
      ["淬毒飞刀", "attack", 2, true, "plain", "earth"],
      ["咬碎糖", "blank", 0, false, "plain", "earth"],
      ["拆解机关", "guard", 1, true, "plain", "earth"],
      ["无音步", "guard", 2, true, "gild", "abyss"],
      ["致命死角", "attack", 3, true, "plain", "abyss"],
    ],
  ),
  marietta: character(
    "marietta",
    "玛丽埃塔",
    "sovereign",
    ["earth", "beyond"],
    [
      ["横扫", "marietta.cleave-right", 2, true, "rust", "earth"],
      ["回扫", "marietta.cleave-left", 2, true, "plain", "earth"],
      ["提线", "marietta.bind", 0, true, "plain", "earth"],
      ["体面", "guard", 3, true, "gild", "earth"],
      ["红线迷宫", "marietta.guard-all", 2, false, "plain", "beyond"],
      ["绞杀红线", "marietta.thread-strike", 4, false, "plain", "beyond"],
    ],
  ),
};
const kinds: [string, DemoActionKind][] = [
  ["attack", "attack"],
  ["guard", "guard"],
  ["heal", "heal"],
  ["wild", "wild"],
  ["blank", "blank"],
  ["kael.protect", "protect"],
  ["elora.expensive-heal", "expensive-heal"],
  ["marietta.cleave-right", "cleave-right"],
  ["marietta.cleave-left", "cleave-left"],
  ["marietta.bind", "bind"],
  ["marietta.guard-all", "guard-all"],
  ["marietta.thread-strike", "thread-strike"],
];
export const DEMO_ACTIONS: DemoContent["actions"] = Object.fromEntries(
  kinds.map(([key, kind]) => [`action.${key}`, { id: `action.${key}`, kind }]),
);
