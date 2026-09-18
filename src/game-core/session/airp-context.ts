import type { AirpContext, AirpHead, AirpKnowledgeEntry, AirpRef } from "../contracts/airp";
import { AIRP_LIMITS } from "../contracts/airp";
import { canonicalJson, ids, invalid, number, text, utf8Size } from "../contracts/validation";
import { sha256 } from "../contracts/sha256";
import { airpHeadAtOrBefore } from "./airp-readers";

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Projects an already verified, deterministic knowledge ledger. It never infers who knows a fact. */
export function assembleAirpContext(input: {
  head: AirpHead; task: AirpContext["task"]; profiles: AirpRef[];
  locus: AirpContext["locus"]; entries: readonly AirpKnowledgeEntry[];
  topicKeys: readonly string[]; requiredEntryIds: readonly string[];
  effectiveFactIds: ReadonlySet<string>;
}): AirpContext {
  const actorIds = ids(input.locus.actorIds, "locus.actorIds", AIRP_LIMITS.actors + 1).sort(lexical);
  if (!actorIds.includes("kael") || actorIds.length < 2) invalid("locus.actorIds", "Include the player and every listening actor");
  number(input.locus.phase, "locus.phase");
  ids(input.entries.map(entry => entry.id), "knowledge.ids");
  const required = new Set(ids([...input.requiredEntryIds], "required", AIRP_LIMITS.knowledgeEntries));
  const eligible = input.entries.filter(entry => {
    const sourceIds = ids(entry.sourceFactIds, `knowledge.${entry.id}.sources`, 16);
    text(entry.summary, `knowledge.${entry.id}.summary`, AIRP_LIMITS.knowledgeText);
    number(entry.phase, `knowledge.${entry.id}.phase`);
    return sourceIds.length > 0 && sourceIds.every(id => input.effectiveFactIds.has(id))
      && airpHeadAtOrBefore(entry.source, input.head) && entry.phase <= input.locus.phase
      && (entry.knowledge.kind === "public" || actorIds.every(actor => entry.knowledge.kind === "shared" && entry.knowledge.actorIds.includes(actor)))
      && (required.has(entry.id) || entry.topicKeys.some(topic => input.topicKeys.includes(topic)));
  });
  if ([...required].some(id => !eligible.some(entry => entry.id === id))) invalid("context", "Required knowledge is unavailable or not shared", "airp-context-unavailable");
  eligible.sort((a, b) => Number(required.has(b.id)) - Number(required.has(a.id)) || b.phase - a.phase || lexical(a.id, b.id));
  const selected = eligible.slice(0, AIRP_LIMITS.knowledgeEntries);
  const build = (): AirpContext => {
    const body = {
      contractVersion: 1 as const, source: input.head, task: input.task,
      profiles: [...input.profiles].sort((a, b) => lexical(a.id, b.id)),
      agenda: selected.filter(entry => entry.axis === "agenda"), bond: selected.filter(entry => entry.axis === "bond"),
      locus: { ...input.locus, actorIds }, omittedEntryCount: eligible.length - selected.length,
    };
    const contextHash = sha256(canonicalJson(body));
    return JSON.parse(JSON.stringify({ ...body, contextHash })) as AirpContext;
  };
  let result = build();
  while (utf8Size(JSON.stringify(result)) > AIRP_LIMITS.contextBytes) {
    const last = selected[selected.length - 1];
    if (!last || required.has(last.id)) invalid("context", "Required context exceeds byte budget", "airp-context-capacity");
    selected.pop(); result = build();
  }
  return result;
}
