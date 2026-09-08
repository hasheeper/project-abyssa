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
  { id: "A1-01", name: "大教堂", act: 1, image: cg("01-cathedral"), duration: 5500, delay: 2800, transition: 1400,
    camera: still(.48), effect: "gold",
    beats: [
      {"text": "很久很久以前，世界曾被黑暗笼罩。"},
      {"text": "可怕的怪物在大地上肆虐，人们只能在恐惧中苟延残喘。"}
    ] },
  { id: "A1-02", name: "光之勇者", act: 1, image: cg("02-hero-of-light"), duration: 5500, delay: 700, transition: 1600,
    camera: still(.42), effect: "hero",
    beats: [
      {"text": "为了拯救陷入绝望的人们，神明将圣剑赐给了一位少年。"},
      {"text": "身披光芒、讨伐邪恶的希望象征——勇者。"}
    ] },
  { id: "A1-03", name: "异形魔王", act: 1, image: cg("03-stained-glass-tyrant"), duration: 5500, delay: 1100, transition: 1400,
    camera: still(.45), effect: "tyrant",
    beats: [
      {"text": "挡在他面前的，是君临黑暗深处、绝对的恐怖——魔王。"}
    ] },
  { id: "A1-04", name: "激突与破碎", act: 1, image: cg("04-sword-and-shattered-glass"), duration: 5500, delay: 500, transition: 1900,
    camera: still(.43), effect: "glass",
    beats: [
      {"text": "经历了惨烈的激战，勇者的剑终于贯穿了魔王的心脏。"},
      {"text": "怪物被消灭，世界迎回了光明与和平。"},
      {"text": "——教会的圣典上，一直都是这么写的。", "hold": 2200}
    ] },
  { id: "A2-01", name: "战壕", act: 2, image: cg("05-muddy-trenches"), duration: 6000, delay: 1900, transition: 600,
    camera: move(frame(1.015, .5, .50), frame(1.035, .5, .48), 6000, 2.3), effect: "rain",
    beats: [
      {"text": "死人是读不了历史书的。"},
      {"text": "前线留下的，只有不断腐烂的血肉与白骨。"}
    ] },
  { id: "A2-02", name: "营火", act: 2, image: cg("06-rainy-campfire"), duration: 7000, delay: 800, transition: 600,
    camera: move(frame(1.06, .478, .47), frame(1.06, .522, .47), 7000, 1.2), effect: "fire",
    beats: [
      {"text": "所谓的远征军，根本不是什么英雄。"},
      {"text": "几个失势的名门小姐，还有我这么个毫无背景的步兵。"},
      {"text": "从一开始，上头就没打算让任何人活着回去。"}
    ] },
  { id: "A2-03", name: "棋子", act: 2, image: cg("07-discarded-pawns"), duration: 5000, delay: 500, transition: 300,
    camera: move(frame(), frame(1.015), 5000), effect: "chess",
    beats: [
      {"text": "缩在安全区里的大人物们以为，只要斩下魔王的头，一切就都万事大吉了。\n然而——"}
    ] },
  { id: "A2-04", name: "逆行", act: 2, image: cg("08-against-the-tide"), duration: 6000, delay: 1000, transition: 800,
    camera: move(frame(1.015, .5, .50), frame(1.075, .5, .51), 6000, 2.3), effect: "rift",
    beats: [
      {"text": "凡人是杀不死天灾的。"},
      {"text": "当天坑深处彻底决堤的那一刻，所有算计都在瞬间变成了废纸。"}
    ] },
  { id: "A3-01", name: "深渊之底", act: 3, image: cg("09-abyss-bound-child"), duration: 5500, delay: 1000, transition: 600,
    camera: move(frame(1.02, .5, .47), frame(1.07, .5, .47, 4), 5500), effect: "vortex",
    beats: [
      {"text": "大坑的底下，既没有王座，也没有军队。"},
      {"text": "有的——只是一个被迫灌满了烂泥、连哭泣都已经忘却的孩子。"}
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
  { id: "A3-04", name: "黑海", act: 3, image: cg("12-sleeping-black-sea"), duration: 5000, delay: 800, transition: 1500,
    camera: { kind: "move", from: frame(1.08, .5, .51), to: frame(1, .5, .5), duration: 5000, easing: "retreat" }, effect: "sea",
    beats: [
      {"text": "暴走停下来了，世界只是——暂时睡着了。"},
      {"text": "被同归于尽吓破了胆的人类和魔族，就在当天草草定了停战。"}
    ] },
  { id: "sound-bridge", name: "三年后", act: 4, duration: 4500, delay: 1500, transition: 800,
    camera: still(), effect: "black", beats: [
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
      {"text": "仗算是彻底打完了，同伴们也全都赖在这里不走。"},
      {"text": "沙发上的银发魔王裹着毛毯四仰八叉地睡着回笼觉；"},
      {"text": "脚底下的阴影里，小黑泥精正心满意足地叼着刚偷来的香肠溜走。"},
      {"text": "至于什么世界的命运——\n比起赶在那家伙闹脾气把悬崖整个扬掉之前、让她吃上一顿热乎的早饭，那都是天大的闲事。", "hold": 2200}
    ] },
  { id: "title-card", name: "标题", act: 4, image: cg("15-watchers-cliff-morning"), duration: 5000, delay: 0, transition: 1100,
    camera: { kind: "still", frame: frame(1.06, .515, .49) }, effect: "title", beats: [] },
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
