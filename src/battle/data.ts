import domainsOfChaos from "../assets/png3/background/domains_of_chaos.png";
import eloraSprite from "../assets/png3/elora.png";
import eusticeSprite from "../assets/png3/eustice.png";
import kororoSprite from "../assets/png3/kororo.png";
import normaSprite from "../assets/png3/norma.png";
import abyssaSprite from "../assets/png3/abyssa.png";
import blightedSentinelSprite from "../assets/png3/monster/blighted_sentinel.png";
import miasmaAmalgamSprite from "../assets/png3/monster/miasma_amalgam.png";
import eloraStandingPortrait from "../assets/png/elora.png";
import eusticeStandingPortrait from "../assets/png/eustice.png";
import kororoStandingPortrait from "../assets/png/kororo.png";
import normaStandingPortrait from "../assets/png/norma.png";
import eloraAvatar from "../assets/avatar/elora.png";
import eusticeAvatar from "../assets/avatar/eustice.png";
import kororoAvatar from "../assets/avatar/kororo.png";
import normaAvatar from "../assets/avatar/norma.png";
import type {
  BattleAlly,
  BattleEnemy,
  BattleScene,
  BattleTurnEntry
} from "../components/BattleScreen";

export interface BattlePreviewFixture {
  scene: BattleScene;
  allies: BattleAlly[];
  enemies: BattleEnemy[];
  turnOrder: BattleTurnEntry[];
  activeActorId: string;
}

const allyPoseAdjustments: BattleAlly["poseAdjustments"] = {
  idle: { offsetX: 0, offsetY: 0, scale: 1 },
  action: { offsetX: -2, offsetY: 0, scale: 1 },
  hurt: { offsetX: 0, offsetY: 0, scale: 1 },
  guard: { offsetX: 0, offsetY: 0, scale: 1 }
};

const baseAllies: BattleAlly[] = [
  {
    id: "eustice",
    name: "Eustace",
    portraitUrl: eusticeStandingPortrait,
    portraitAlt: "尤斯缇丝立绘",
    spriteSheetUrl: eusticeSprite,
    spriteAlt: "尤斯缇丝战斗姿态",
    flipSprite: true,
    hp: 450,
    maxHp: 500,
    mp: 130,
    maxMp: 300,
    placement: { x: 49, y: 63, scale: 1.04, zIndex: 13 },
    poseAdjustments: allyPoseAdjustments
  },
  {
    id: "elora",
    name: "Elora",
    portraitUrl: eloraStandingPortrait,
    portraitAlt: "艾洛拉立绘",
    spriteSheetUrl: eloraSprite,
    spriteAlt: "艾洛拉战斗姿态",
    flipSprite: true,
    hp: 390,
    maxHp: 420,
    mp: 480,
    maxMp: 500,
    placement: { x: 42, y: 69, scale: 0.93, zIndex: 15 },
    poseAdjustments: allyPoseAdjustments
  },
  {
    id: "kororo",
    name: "Kororo",
    portraitUrl: kororoStandingPortrait,
    portraitAlt: "柯萝萝立绘",
    spriteSheetUrl: kororoSprite,
    spriteAlt: "柯萝萝战斗姿态",
    flipSprite: true,
    hp: 310,
    maxHp: 350,
    mp: 450,
    maxMp: 500,
    placement: { x: 33, y: 63, scale: 0.94, zIndex: 12 },
    poseAdjustments: allyPoseAdjustments
  },
  {
    id: "norma",
    name: "Norma",
    portraitUrl: normaStandingPortrait,
    portraitAlt: "诺玛立绘",
    spriteSheetUrl: normaSprite,
    spriteAlt: "诺玛战斗姿态",
    flipSprite: true,
    hp: 405,
    maxHp: 450,
    mp: 105,
    maxMp: 160,
    placement: { x: 25, y: 69, scale: 0.92, zIndex: 14 },
    poseAdjustments: allyPoseAdjustments
  }
];

const allies: BattleAlly[] = baseAllies.map((ally) => ({
  ...ally,
  placement: {
    ...ally.placement,
    x: ally.placement.x - 6,
    y: ally.placement.y + 1
  },
  ...(ally.id === "elora"
    ? {
        hp: 118,
        floatingFeedback: [
          { id: "miasma-burn", text: "-286", tone: "damage", offsetX: 2, offsetY: -8 }
        ]
      }
    : {})
}));

export const abyssaBoss: BattleEnemy = {
  id: "abyssa",
  name: "Abyssa",
  portraitUrl: abyssaSprite,
  portraitAlt: "Abyssa",
  spriteUrl: abyssaSprite,
  spriteAlt: "Abyssa Boss",
  hp: 8400,
  maxHp: 10000,
  placement: {
    x: 84,
    y: 65,
    scale: 1.7,
    zIndex: 11,
    anchorX: 50,
    anchorY: 100
  }
};

const enemies: BattleEnemy[] = [
  {
    id: "blighted-sentinel",
    name: "凋零哨卫",
    portraitUrl: blightedSentinelSprite,
    portraitAlt: "凋零哨卫",
    spriteUrl: blightedSentinelSprite,
    spriteAlt: "与枯木融为一体的凋零哨卫",
    hp: 1720,
    maxHp: 2200,
    placement: {
      x: 70,
      y: 72,
      scale: 1.18,
      zIndex: 10,
      anchorX: 50,
      anchorY: 100
    }
  },
  {
    id: "miasma-amalgam",
    name: "瘴气聚合体",
    portraitUrl: miasmaAmalgamSprite,
    portraitAlt: "瘴气聚合体",
    spriteUrl: miasmaAmalgamSprite,
    spriteAlt: "在混沌领域中蠕动的瘴气聚合体",
    hp: 2460,
    maxHp: 2800,
    placement: {
      x: 84,
      y: 70,
      scale: 0.88,
      zIndex: 11,
      anchorX: 50,
      anchorY: 100
    }
  }
];

export const battleFixture: BattlePreviewFixture = {
  scene: {
    id: "domains-of-chaos",
    tone: "chaos",
    label: "混沌领域",
    backgroundUrl: domainsOfChaos,
    backgroundAlt: "血肉侵蚀遗迹构成的混沌领域"
  },
  allies,
  enemies,
  activeActorId: "elora",
  turnOrder: [
    { id: "chaos-01", unitId: "elora", side: "ally", label: "艾洛拉", portraitUrl: eloraAvatar, portraitAlt: "艾洛拉" },
    { id: "chaos-02", unitId: "miasma-amalgam", side: "enemy", label: "瘴气聚合体", portraitUrl: miasmaAmalgamSprite, portraitAlt: "瘴气聚合体" },
    { id: "chaos-03", unitId: "eustice", side: "ally", label: "尤斯缇丝", portraitUrl: eusticeAvatar, portraitAlt: "尤斯缇丝" },
    { id: "chaos-04", unitId: "blighted-sentinel", side: "enemy", label: "凋零哨卫", portraitUrl: blightedSentinelSprite, portraitAlt: "凋零哨卫" },
    { id: "chaos-05", unitId: "kororo", side: "ally", label: "柯萝萝", portraitUrl: kororoAvatar, portraitAlt: "柯萝萝" },
    { id: "chaos-06", unitId: "norma", side: "ally", label: "诺玛", portraitUrl: normaAvatar, portraitAlt: "诺玛" }
  ]
};
