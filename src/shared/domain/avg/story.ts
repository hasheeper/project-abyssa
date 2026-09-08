import { EMOTION_LABELS, type EmotionId } from "../presentation/emotion";
import type { ActorMotion } from "../presentation/performance";

export const AVG_EFFECTS = ["pressure", "release", "break", "handoff", "crack", "equip"] as const;
export const AVG_SOUNDS = ["wood", "metal", "glass", "cloth", "ceramic"] as const;
export const AVG_MOTIONS = ["nod", "waver", "jump", "shakeLight", "shakeHeavy"] as const satisfies readonly ActorMotion[];
export type AvgEffect = typeof AVG_EFFECTS[number];
export type AvgSound = typeof AVG_SOUNDS[number];
export type AvgStageCue = { actorId: string; emotion?: EmotionId; motion?: ActorMotion; aside?: string; still?: boolean };
type FrameBase = { id: string; effect?: AvgEffect; sound?: AvgSound; stage?: AvgStageCue[]; itemId?: string };
export type AvgFrame = FrameBase & (
  | { kind: "dialogue"; actorId: string; text: string; emotion?: EmotionId }
  | { kind: "narration"; text: string }
  | { kind: "direction"; waitMs: number }
  | { kind: "chapter"; text: string }
);
export type AvgChoice = "A" | "B" | "C";
type NodeBase = { id: string; cursor: number; sectionId: string };
export type AvgNode = NodeBase & (
  | { kind: "beat"; frames: AvgFrame[] }
  | { kind: "choice"; prompt: string; options: { id: AvgChoice; label: string }[] }
  | { kind: "branch"; choiceId: string; variants: { A: AvgFrame[]; B: AvgFrame[]; C?: AvgFrame[] } }
);
export type AvgStory = {
  $schema?: string; schemaVersion: 1; id: string; title: string; locale: "zh-CN";
  presentation: { stagePreset: string; backgroundId: string; defaultMode: "adv" | "nvl"; allowRp: boolean; initialSlots: { left?: string; right?: string }; arrival?: {eyebrow: string; title: string} };
  player: { actorId: string; nameToken: "{{user}}"; authoredSpeech: boolean };
  cast: string[]; sections: { id: string; title: string }[]; nodes: AvgNode[];
};

/** Paths are suitable for authoring diagnostics; unknown fields fail rather than silently disappearing. */
export function avgInvalid(path: string, detail: string): never { throw new Error(`AVG ${path}: ${detail}`); }
export function avgObject(raw: unknown, path: string, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) avgInvalid(path, "expected object");
  const value = raw as Record<string, unknown>;
  for (const key of required) if (!Object.hasOwn(value, key)) avgInvalid(`${path}.${key}`, "required");
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) avgInvalid(`${path}.${key}`, "unknown field");
  return value;
}
export function avgText(raw: unknown, path: string, max = 2000): asserts raw is string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > max) avgInvalid(path, `expected 1–${max} characters`);
}
export function avgEnum(raw: unknown, path: string, values: readonly string[]): void {
  if (typeof raw !== "string" || !values.includes(raw)) avgInvalid(path, `expected ${values.join(" / ")}`);
}
function identifier(raw: unknown, path: string) { avgText(raw, path, 192); if (!/^[\w.:-]+$/.test(raw)) avgInvalid(path, "invalid identifier"); }
function array(raw: unknown, path: string, max: number, min = 1): unknown[] {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) avgInvalid(path, `expected ${min}–${max} entries`);
  return raw;
}
function boolean(raw: unknown, path: string) { if (typeof raw !== "boolean") avgInvalid(path, "expected boolean"); }
function unique(values: unknown[], path: string) { if (new Set(values).size !== values.length) avgInvalid(path, "duplicate identity"); }

export function validateAvgFrames(raw: unknown, path: string, cast: readonly string[], player?: AvgStory["player"]): asserts raw is AvgFrame[] {
  const frames = array(raw, path, 16);
  const ids: unknown[] = [];
  frames.forEach((value, index) => {
    const p = `${path}[${index}]`;
    if (!value || typeof value !== "object") avgInvalid(p, "expected frame");
    const kind = (value as Record<string, unknown>).kind;
    avgEnum(kind, `${p}.kind`, ["dialogue", "narration", "direction", "chapter"]);
    const f = avgObject(value, p, ["id", "kind", ...(kind === "direction" ? ["waitMs"] : ["text"]), ...(kind === "dialogue" ? ["actorId"] : [])], ["effect", "sound", "stage", "itemId", ...(kind === "dialogue" ? ["emotion"] : [])]);
    identifier(f.id, `${p}.id`); ids.push(f.id);
    if (kind === "direction") {
      if (!Number.isInteger(f.waitMs) || (f.waitMs as number) < 1 || (f.waitMs as number) > 10000) avgInvalid(`${p}.waitMs`, "expected 1–10000 ms");
    } else avgText(f.text, `${p}.text`);
    if (kind === "dialogue") {
      avgEnum(f.actorId, `${p}.actorId`, cast);
      if (player && !player.authoredSpeech && f.actorId === player.actorId) avgInvalid(p, "player speech is disabled");
    }
    if (f.emotion !== undefined) avgEnum(f.emotion, `${p}.emotion`, Object.keys(EMOTION_LABELS));
    if (f.effect !== undefined) avgEnum(f.effect, `${p}.effect`, AVG_EFFECTS);
    if (kind === "chapter" && f.effect !== undefined && f.effect !== "handoff" || kind !== "chapter" && f.effect === "handoff") avgInvalid(`${p}.effect`, "handoff belongs to a chapter frame");
    if (f.sound !== undefined) avgEnum(f.sound, `${p}.sound`, AVG_SOUNDS);
    if (f.itemId !== undefined) identifier(f.itemId, `${p}.itemId`);
    if (f.stage !== undefined) {
      const actors = array(f.stage, `${p}.stage`, 8, 0).map((cue, i) => {
        const cp = `${p}.stage[${i}]`, c = avgObject(cue, cp, ["actorId"], ["emotion", "motion", "aside", "still"]);
        avgEnum(c.actorId, `${cp}.actorId`, cast);
        if (c.emotion !== undefined) avgEnum(c.emotion, `${cp}.emotion`, Object.keys(EMOTION_LABELS));
        if (c.motion !== undefined) avgEnum(c.motion, `${cp}.motion`, AVG_MOTIONS);
        if (c.aside !== undefined) avgText(c.aside, `${cp}.aside`, 100);
        if (c.still !== undefined) boolean(c.still, `${cp}.still`);
        if (c.still === true && c.motion !== undefined) avgInvalid(cp, "still and motion conflict");
        return c.actorId;
      });
      unique(actors, `${p}.stage`);
    }
  });
  unique(ids, path);
}

/** Pure JSON boundary: no DOM, assets, save commands, evaluation or network calls. */
export function parseAvgStory(raw: unknown): AvgStory {
  if (typeof raw === "string") {
    if (raw.length > 2_000_000) avgInvalid("story", "file too large");
    raw = JSON.parse(raw);
  }
  const s = avgObject(raw, "story", ["schemaVersion", "id", "title", "locale", "presentation", "player", "cast", "sections", "nodes"], ["$schema"]);
  if (s.schemaVersion !== 1) avgInvalid("schemaVersion", "unsupported version");
  if (s.$schema !== undefined) avgText(s.$schema, "$schema", 256);
  identifier(s.id, "id"); avgText(s.title, "title", 100); avgEnum(s.locale, "locale", ["zh-CN"]);
  const cast = array(s.cast, "cast", 32); cast.forEach((id, i) => identifier(id, `cast[${i}]`)); unique(cast, "cast");
  const player = avgObject(s.player, "player", ["actorId", "nameToken", "authoredSpeech"]);
  avgEnum(player.actorId, "player.actorId", cast as string[]); avgEnum(player.nameToken, "player.nameToken", ["{{user}}"]); boolean(player.authoredSpeech, "player.authoredSpeech");
  const p = avgObject(s.presentation, "presentation", ["stagePreset", "backgroundId", "defaultMode", "allowRp", "initialSlots"], ["arrival"]);
  if (p.arrival !== undefined) {
    const arrival = avgObject(p.arrival, "presentation.arrival", ["eyebrow", "title"]);
    avgText(arrival.eyebrow, "presentation.arrival.eyebrow", 100); avgText(arrival.title, "presentation.arrival.title", 100);
  }
  identifier(p.stagePreset, "presentation.stagePreset"); identifier(p.backgroundId, "presentation.backgroundId");
  avgEnum(p.defaultMode, "presentation.defaultMode", ["adv", "nvl"]); boolean(p.allowRp, "presentation.allowRp");
  if (p.defaultMode === "nvl" && !p.allowRp) avgInvalid("presentation", "RP disabled but selected as default");
  const slots = avgObject(p.initialSlots, "presentation.initialSlots", [], ["left", "right"]);
  Object.values(slots).forEach(id => avgEnum(id, "presentation.initialSlots", cast as string[])); unique(Object.values(slots), "presentation.initialSlots");
  const sections = array(s.sections, "sections", 200).map((section, i) => {
    const p = `sections[${i}]`, v = avgObject(section, p, ["id", "title"]);
    identifier(v.id, `${p}.id`); avgText(v.title, `${p}.title`, 100); return v.id as string;
  });
  unique(sections, "sections");
  const choices = new Map<string, string[]>(), nodeIds: unknown[] = [], frameIds: string[] = [];
  array(s.nodes, "nodes", 2000).forEach((node, cursor) => {
    const path = `nodes[${cursor}]`;
    const kind = node && typeof node === "object" ? (node as Record<string, unknown>).kind : undefined;
    avgEnum(kind, `${path}.kind`, ["beat", "choice", "branch"]);
    const n = avgObject(node, path, ["id", "cursor", "sectionId", "kind", ...(kind === "beat" ? ["frames"] : kind === "choice" ? ["prompt", "options"] : ["choiceId", "variants"])]);
    identifier(n.id, `${path}.id`); nodeIds.push(n.id);
    if (n.cursor !== cursor) avgInvalid(`${path}.cursor`, "must match stable array index");
    avgEnum(n.sectionId, `${path}.sectionId`, sections);
    const frames = (value: unknown, suffix: string, baseId: string) => {
      validateAvgFrames(value, `${path}.${suffix}`, cast as string[], player as AvgStory["player"]);
      value.forEach((frame, i) => { if (frame.id !== (i === 0 ? baseId : `${baseId}.page.${i}`)) avgInvalid(`${path}.${suffix}[${i}].id`, "must preserve the node/branch page identity"); });
      frameIds.push(...value.map(f => f.id));
    };
    if (kind === "beat") frames(n.frames, "frames", n.id as string);
    else if (kind === "choice") {
      avgText(n.prompt, `${path}.prompt`, 500);
      const ids = array(n.options, `${path}.options`, 3, 2).map((option, i) => {
        const p = `${path}.options[${i}]`, o = avgObject(option, p, ["id", "label"]);
        avgEnum(o.id, `${p}.id`, ["A", "B", "C"]); avgText(o.label, `${p}.label`, 200); return o.id as string;
      });
      if (ids.join("") !== "AB" && ids.join("") !== "ABC") avgInvalid(path, "choices must be ordered A/B[/C]");
      choices.set(n.id as string, ids);
    } else {
      identifier(n.choiceId, `${path}.choiceId`);
      const ids = choices.get(n.choiceId as string);
      if (!ids) avgInvalid(`${path}.choiceId`, "must reference an earlier choice");
      const variants = avgObject(n.variants, `${path}.variants`, ids);
      ids.forEach(id => frames(variants[id], `variants.${id}`, `${n.id}.${id}`));
    }
  });
  unique(nodeIds, "nodes"); unique(frameIds, "frames");
  return JSON.parse(JSON.stringify(s)) as AvgStory;
}
