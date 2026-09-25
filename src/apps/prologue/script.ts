import { PLAYER_NAME_TOKEN } from "../../shared/domain/player-identity";

/** Author's Chinese prologue, verbatim; only screen breaks and presentation cues are added. */
export type PrologueCue = "sword-release" | "embrace-warmth";
export type PrologueBeat = { text: string; speaker?: typeof PLAYER_NAME_TOKEN | "艾比希斯"; hold?: number; cue?: PrologueCue };
export const PROLOGUE_ACT_NAMES = ["神话", "现实", "决断", "日常"] as const;
export const INTERTITLE_FADE_MS = 600;
export const CONTACT_TRANSITION_MS = 120;
export const CONTACT_IMPACT_MS = 560;
/** Local presentation timing only; a save still records the shot, never a cue. */
export const CUE_DURATION_MS: Record<PrologueCue, number> = { "sword-release": 4000, "embrace-warmth": 5500 };
export type CameraKey = { scale: number; x: number; y: number; angle?: number };
export type PrologueCamera =
  | { kind: "still"; frame: CameraKey }
  | { kind: "move"; from: CameraKey; to: CameraKey; duration: number; handheld?: number; easing?: "retreat" };
export type PrologueShot = {
  id: string;
  name: string;
  act: 1 | 2 | 3 | 4;
  image?: string;
  duration: number;
  delay: number;
  transition: number;
  entrance?: "contact";
  camera: PrologueCamera;
  beats: PrologueBeat[];
  effect: "gold" | "hero" | "tyrant" | "glass" | "rain" | "fire" | "chess" | "rift" | "vortex" | "sword" | "embrace" | "sea" | "black" | "kitchen" | "tentacle" | "morning" | "title";
};

const assets = import.meta.glob<string>("../../assets/cg/prologue/*.webp", { eager: true, query: "?url", import: "default" });
const cg = (name: string) => assets[`../../assets/cg/prologue/${name}.webp`];
const frame = (scale = 1, x = .5, y = .5, angle = 0): CameraKey => ({ scale, x, y, angle });

// Act I reads as illustrated records. Later acts retain their authored movement.
const still = (y = .5): PrologueCamera => ({ kind: "still", frame: frame(1, .5, y) });
const move = (from: CameraKey, to: CameraKey, duration: number, handheld = 0): PrologueCamera => ({ kind: "move", from, to, duration, handheld });

export const PROLOGUE_SHOTS: readonly PrologueShot[] = [
  // ==================== 第一幕【神话】 ====================
  { id: "A1-01", name: "大教堂", act: 1, image: cg("01-cathedral"), duration: 6000, delay: 2000, transition: 1400,
    camera: still(.48), effect: "gold",
    beats: [
      {"text": "那是凡世曾被无尽长夜笼罩的年代。"},
      {"text": "死气与灾厄席卷大地，万民在绝望中祈求神明的救赎。"}
    ] },
  { id: "A1-02", name: "光之勇者", act: 1, image: cg("02-hero-of-light"), duration: 6000, delay: 700, transition: 1600,
    camera: still(.42), effect: "hero",
    beats: [
      {"text": "为了斩断绝望，神明将讨伐黑暗的圣剑赐予凡人。"},
      {"text": "身披晨曦之光、背负万民期望的救世之剑——勇者。"}
    ] },
  { id: "A1-03", name: "异形魔王", act: 1, image: cg("03-stained-glass-tyrant"), duration: 6000, delay: 800, transition: 1400,
    camera: still(.45), effect: "tyrant",
    beats: [
      {"text": "而在长夜的最深处，盘踞着撕裂大地的终极梦魇。"},
      {"text": "以千万猩红之眼俯瞰现世、执掌深渊的死敌——魔王。"},
      {"text": "为了诛灭这头灾厄，救世的远征席卷了整座大陆。"}
    ] },
  { id: "A1-04", name: "激突与破碎", act: 1, image: cg("04-sword-and-shattered-glass"), duration: 6500, delay: 500, transition: 1900,
    camera: still(.43), effect: "glass",
    beats: [
      {"text": "十余年的惨烈鏖战，圣剑终于贯穿了魔王的心脏。"},
      {"text": "长夜散尽，诸王之座迎回了光明的庇护与和平。"},
      {"text": "——大教堂的圣典上，百年来，一直都是这么写的。", "hold": 2400}
    ] },

  // ==================== 第二幕【现实】 ====================
  { id: "A2-01", name: "战壕", act: 2, image: cg("05-muddy-trenches"), duration: 6000, delay: 1900, transition: 600,
    camera: move(frame(1.015, .5, .50), frame(1.035, .5, .48), 6000, 2.3), effect: "rain",
    beats: [
      {"text": "王都的文书上，把这趟出征叫作‘第四次圣战’。"},
      {"text": "但大军停在边境要塞后面，真正被赶过界线、推进这片烂泥里的……只有我们。"}
    ] },
  { id: "A2-02", name: "营火", act: 2, image: cg("06-rainy-campfire"), duration: 7000, delay: 800, transition: 600,
    camera: move(frame(1.06, .478, .47), frame(1.06, .522, .47), 7000, 1.2), effect: "fire",
    beats: [
      {"text": "所谓的远征先锋，其实谁心里都清楚。"},
      {"text": "几个失势的名门小姐，加上我这么个凑数的步兵。"},
      {"text": "从一开始，上头就没打算让任何人活着回去。"}
    ] },
  { id: "A2-03", name: "棋子", act: 2, image: cg("07-discarded-pawns"), duration: 5000, delay: 500, transition: 300,
    camera: move(frame(), frame(1.015), 5000), effect: "chess",
    beats: [
      {"text": "坐在后方的人，把前线的死活算成了彼此制衡的筹码。"},
      {"text": "他们算计着政敌的存亡，算计着战后的权柄，以为整座大陆的命运全在掌心里。"}
    ] },
  { id: "A2-04", name: "逆行", act: 2, image: cg("08-against-the-tide"), duration: 6000, delay: 1000, transition: 800,
    camera: move(frame(1.015, .5, .50), frame(1.075, .5, .51), 6000, 2.3), effect: "rift",
    beats: [
      {"text": "直到地底深处彻底决堤。"},
      {"text": "黑泥吞没防线的那一刻，所有的算计，在瞬间全变成了废纸。"}
    ] },

  // ==================== 第三幕【决断】 ====================
  { id: "A3-01", name: "深渊之底", act: 3, image: cg("09-abyss-bound-child"), duration: 5500, delay: 1000, transition: 600,
    camera: move(frame(1.02, .5, .47), frame(1.07, .5, .47, 4), 5500), effect: "vortex",
    beats: [
      {"text": "深渊的最底下，既没有王座，也没有军队。"},
      {"text": "没有传闻里的暴君，更没有什么吃人的怪物。"},
      {"text": "悬在风暴正中间的，只是个被锁链死死缠住的白发少女。"}
    ] },
  { id: "A3-02", name: "弃剑", act: 3, image: cg("10-fallen-sword"), duration: 5000, delay: 500, transition: 800,
    camera: still(.53), effect: "sword",
    beats: [
      {"text": "杀了她，一切就彻底完了。"},
      {"text": "拔剑没有任何意义。"},
      {"text": "——所以我扔了剑。", "cue": "sword-release", "hold": 1800}
    ] },
  { id: "A3-03", name: "拥抱", act: 3, image: cg("11-embrace"), duration: 6500, delay: 720, transition: 1000, entrance: "contact",
    camera: move(frame(1.025, .5, .47), frame(1.03, .497, .47), 6000), effect: "embrace",
    beats: [
      {"text": "我迎着风暴走上去，伸手一把抱住了她。", "cue": "embrace-warmth"},
      {"text": "刚才还疯了一样的黑泥，在碰到的那一瞬间，全停下了。", "hold": 1800},
      {"text": "", "hold": 3200}
    ] },
  { id: "A3-04", name: "黑海", act: 3, image: cg("12-sleeping-black-sea"), duration: 6000, delay: 800, transition: 1500,
    camera: { kind: "move", from: frame(1.08, .5, .51), to: frame(1, .5, .5), duration: 6000, easing: "retreat" }, effect: "sea",
    beats: [
      {"text": "沸腾的风暴彻底沉成了死水。"},
      {"text": "怀里的灾厄没了动静，就这么安安静静地睡了过去。"},
      {"text": "目睹了那场几乎毁掉一切的狂澜之后，人类和魔族，终于在恐惧里坐上了谈判桌。"}
    ] },

  // ==================== 第四幕【日常】 ====================
  { id: "sound-bridge", name: "三年后", act: 4, duration: 4500, delay: 1500, transition: 800,
    camera: still(), effect: "black",
    beats: [
      {"text": "三年后"}
    ] },
  { id: "A4-01", name: "厨房", act: 4, image: cg("13-morning-kitchen"), duration: 6000, delay: 1000, transition: 500,
    camera: move(frame(1.02, .5, .47), frame(1.03, .503, .473), 6000, 2.3), effect: "kitchen",
    beats: [
      {"text": "谁都不敢把随时可能爆炸的怪物接回家，于是在大陆边境的断崖上，建起了这栋洋馆。"}
    ] },
  { id: "A4-02", name: "攻防", act: 4, image: cg("14-sausage-and-tentacle"), duration: 5500, delay: 720, transition: 600, entrance: "contact",
    camera: move(frame(1.02, .5, .49), frame(1.02, .5, .49), 5500, 1.2), effect: "tentacle",
    beats: [
      {"text": "“手缩回去，还没开饭呢。”", "speaker": PLAYER_NAME_TOKEN},
      {"text": "“……就一口。”", "speaker": "艾比希斯"},
      {"text": "“不行，洗脸去。”", "speaker": PLAYER_NAME_TOKEN}
    ] },
  { id: "A4-03", name: "晨景全貌", act: 4, image: cg("15-watchers-cliff-morning"), duration: 6500, delay: 900, transition: 0,
    camera: move(frame(1.01, .5, .49), frame(1.06, .515, .49), 6500, 2.3), effect: "morning",
    beats: [
      {"text": "仗打完了，到头来，谁也没打算回王都，大家就这么在悬崖边安了家。"},
      {"text": "沙发上的银发魔王裹着毛毯四仰八叉地睡着回笼觉；"},
      {"text": "脚底下的阴影里，小黑泥精正心满意足地叼着刚偷来的香肠溜走。"},
      {"text": "至于什么世界的命运——"},
      {"text": "在让她吃上一顿热乎的早饭之前，那都是天大的闲事。", "hold": 2200}
    ] },
  { id: "title-card", name: "标题", act: 4, image: cg("15-watchers-cliff-morning"), duration: 5000, delay: 0, transition: 1100,
    camera: { kind: "still", frame: frame(1.06, .515, .49) }, effect: "title",
    beats: [
      {"text": "", "hold": 5000} // ← 补上空节拍，驱动标题卡停留5秒
    ] },
];

export const CHARACTER_FADE_MS = 25;
export const PARAGRAPH_BREATH_MS = 850;
export function typingDuration(beat: PrologueBeat) { return Array.from(beat.text).length * CHARACTER_FADE_MS + 220; }
/** Chinese reading time is additional to the fade, not a 90-second forced cut. */
export function readingDuration(beat: PrologueBeat) { return typingDuration(beat) + Math.max(beat.hold ?? 0, 1500, Array.from(beat.text).length * 105); }

export function shotEndTime(shot: PrologueShot, cueTime: number | null) {
  const cue = shot.beats.find(beat => beat.cue)?.cue;
  return cue ? Math.max(shot.duration, cueTime === null ? Infinity : cueTime + CUE_DURATION_MS[cue]) : shot.duration;
}