import { archiveIdentities } from "../../../content/characters/identities";
import { PARTY_VISUALS, partyVisual } from "../presentation/expedition-visuals";
import type { LootOutcome } from "./loot-types";

/** Presentation-only: who greets the party is decided here, never by the ledger. */
export type LedgerSpeaker = { id: string; name: string; title?: string; portrait: string; line: string };
export type LedgerPartyTag = "ok" | "hurt" | "down" | "pulled" | "scar";

export const LEDGER_PARTY_TAGS: Record<LedgerPartyTag, string> = {
  ok: "完好", hurt: "负伤", down: "力竭带回", pulled: "红线牵回", scar: "曾力竭",
};

const HOMECOMING: Record<string, string> = {
  kael: "都回来了就好。今晚我下厨，你们先把靴子脱了。",
  eustice: "全员归队。先处理伤口，复盘留到明早——这是命令。",
  elora: "账我来记，伤我来治。大家先坐下，热汤马上就好。",
  kororo: "……回来了就好。沙发今天让给你，只有今天哦。",
  norma: "善后交给我。门口那串泥脚印，也算在里面。",
  marietta: "欢迎回来。热水与茶都已备好，请先歇一歇吧。",
};
const OUTCOME_VOICE: Record<LootOutcome, { id: string; line: string }> = {
  retreated: { id: "eustice", line: "撤退是指挥判断，不是失败。……把这一行记下来，下次我会带你们走到底。" },
  cleared: { id: "elora", line: "账算好了哦。这趟多出来的，够给汤里多加半勺甜浆果了呢。" },
  failed: { id: "kororo", line: "……所以说，早点回来睡觉不好吗。红线勒得好痛，下次不许再这样了——队长。" },
};

const hasVisual = (id: string): id is keyof typeof PARTY_VISUALS => id in PARTY_VISUALS;

/** The outcome's own voice when present, else the first companion, else the player. */
export function ledgerSpeaker(outcome: LootOutcome, partyIds: readonly string[], playerName?: string): LedgerSpeaker | undefined {
  const voice = OUTCOME_VOICE[outcome];
  const present = partyIds.filter(hasVisual);
  const id = present.includes(voice.id) ? voice.id : present.find(member => member !== "kael") ?? "kael";
  if (!hasVisual(id)) return undefined;
  const visual = partyVisual(id, playerName);
  return {
    id,
    name: visual.name,
    title: archiveIdentities.find(identity => identity.id === id)?.status.title,
    portrait: visual.portrait,
    line: id === voice.id ? voice.line : HOMECOMING[id] ?? HOMECOMING.kael,
  };
}

export function ledgerPartyTag(member: { hp: number; maxHp: number; pulled?: boolean; scarred?: boolean }): LedgerPartyTag {
  if (member.pulled) return "pulled";
  if (member.hp <= 0) return "down";
  if (member.scarred) return "scar";
  return member.hp < member.maxHp ? "hurt" : "ok";
}
