import type { AnyGameRecord } from "./versions/demo-contracts";
import type { GameFact } from "./contracts";

export type CharacterHistoryEntry = {
  id: string;
  sourceFactIds: string[];
  runId: string | null;
  encounterId: string | null;
  worldTime: GameFact["worldTime"];
  kind: string;
  origin?: "memory" | "present" | "adventure";
  layer?: number;
  count: number;
  amount: number;
  wiped?: boolean;
  eventId?: string;
  memoryTemplate?: string;
};
/** A lifetime view of a validated archive, separate from single-run and AI history. */
export function projectCharacterHistory(
  record: AnyGameRecord,
  characterId: string,
): CharacterHistoryEntry[] {
  if (record.schemaVersion === 4) {
    const current = record.facts.flatMap((f): CharacterHistoryEntry[] => {
      if (record.retractedFactIds.includes(f.id)) return [];
      if (f.kind === "combat" || f.kind === "journey") {
        const grouped = new Map<string, CharacterHistoryEntry>();
        for (const e of f.payload.events) {
          if (e.actorId !== characterId || !["healing-applied", "enemy-defeated", "unit-downed", "covenant-triggered"].includes(e.type)) continue;
          const p = e.payload as Record<string, unknown>, previous = grouped.get(e.type);
          if (previous) { previous.count++; previous.amount += Number(p.applied ?? 0); }
          else grouped.set(e.type, {id:`${f.id}:${e.type}`, sourceFactIds:[f.id], runId:f.runRef?.id ?? null, encounterId:null, worldTime:f.worldTime, kind:e.type, origin:f.origin, memoryTemplate:record.contentRef.contentVersion >= 3 ? "clockwork" : "marietta", count:1, amount:Number(p.applied ?? 0)});
        }
        return [...grouped.values()];
      }
      if (f.kind !== "progression") return [];
      const e = f.payload;
      if (e.type === "expedition-settled") {
        const participant = e.terminal.partyIds.includes(characterId);
        const takeover = record.snapshot.campaign.manor?.takeover?.terminalId === e.terminal.id;
        const base = {sourceFactIds:[f.id],runId:e.terminal.runId,encounterId:null,worldTime:f.worldTime,origin:f.origin,count:1,amount:0};
        return [
          ...(participant ? [{...base,id:f.id,kind:"expedition-result",layer:e.terminal.deepestLayer,wiped:e.terminal.outcome === "wipe"}] : []),
          ...(takeover && (participant || characterId === "marietta") ? [{...base,id:`${f.id}:takeover`,kind:"manor-takeover-completed"}] : []),
        ];
      }
      if(e.type === "story-completed") {
        const growth = record.snapshot.campaign.growthGrants.find(g=>g.id===f.id);
        const entries: CharacterHistoryEntry[] = [];
        const base = {sourceFactIds:[f.id],runId:null,encounterId:null,worldTime:f.worldTime,origin:f.origin,memoryTemplate:record.contentRef.contentVersion >= 3 ? "clockwork" : "marietta",count:1,amount:0};
        if(growth && (growth.growthId.startsWith(`growth.${characterId}.`) || characterId === "kael")) entries.push({...base,id:f.id,kind:"growth-completed",eventId:`event.${growth.growthId}`});
        if(record.snapshot.campaign.giftGrantId===f.id && ["kael","marietta"].includes(characterId)) entries.push({...base,id:f.id,kind:"preparation-gift",eventId:"event.demo.preparation-gift"});
        if(record.snapshot.campaign.teamMilestone?.sourceGrantId===f.id && characterId==="kael") entries.push({...base,id:`${f.id}:team-milestone`,kind:"team-milestone",eventId:"story.kael.team-lv3-guard"});
        if(entries.length) return entries;
      }
      const kind = e.type === "memory-ended" && e.terminal.finalBattle.run.party.some(p => p.id === characterId) && e.terminal.finalBattle.encounter.outcome === "victory" ? "memory-completed"
        : e.type === "story-completed" && f.id === record.snapshot.campaign.chapterClaim?.id && characterId === "marietta" ? "marietta-sortie-unlocked" : null;
      return kind ? [{id:f.id,sourceFactIds:[f.id],runId:f.runRef?.id??null,encounterId:null,worldTime:f.worldTime,kind,origin:f.origin,memoryTemplate:record.contentRef.contentVersion >= 3 ? "clockwork" : "marietta",count:1,amount:0}] : [];
    });
    const previous = record.originRef && record.originRef.kind !== "cycle" ? projectCharacterHistory(record.originRef.source,characterId).filter(e=>!e.sourceFactIds.some(id=>record.retractedFactIds.includes(id))) : [];
    return [...previous,...current];
  }
  const withdrawn = new Set(record.retractedFactIds);
  const visible = record.facts.filter(
    (f) =>
      f.source.saveId === record.head.saveId &&
      f.source.epoch === record.head.epoch &&
      f.source.revision <= record.head.revision &&
      f.origin !== "simulation" &&
      !withdrawn.has(f.id) &&
      (f.version !== 1
        ? f.visibility === "party"
        : f.visibility.type === "player" ||
          (f.visibility.type === "party" && f.visibility.actorIds.length > 0)),
  );
  const parties = new Map<string, string[]>();
  for (const f of visible) {
    if (f.kind === "expedition-started") {
      const id = f.version === 1 ? f.expeditionId : f.runRef?.id;
      const p = f.payload as {partyIds?: string[]};
      if (id && p.partyIds) parties.set(id, p.partyIds);
    }
  }
  const grouped = new Map<string, CharacterHistoryEntry>();
  for (const f of visible) {
    const runId = f.version !== 1 ? (f.runRef?.id ?? null) : f.expeditionId;
    const p = f.payload as Record<string, unknown>;
    const actor = f.version !== 1 ? f.actorId : p.actorId;
    const participant =
      runId !== null && parties.get(runId)?.includes(characterId);
    let kind: string | null = null;
    if (
      participant &&
      [
        "expedition-started",
        "layer-cleared",
        "layer-banked",
        "expedition-finished",
        "expedition-settled",
        "manor-takeover-completed",
      ].includes(f.kind)
    )
      kind = f.kind === "layer-banked" ? "layer-cleared" : f.kind;
    if (f.kind === "healing-applied" && actor === characterId)
      kind = "healing-applied";
    if (
      f.version === 1 &&
      f.kind === "damage-applied" &&
      p.targetKind === "party-member" &&
      p.targetId === characterId &&
      p.hpAfter === 0
    )
      kind = "unit-downed";
    if (
      f.version !== 1 &&
      actor === characterId &&
      ["enemy-defeated", "unit-downed", "covenant-triggered"].includes(f.kind)
    )
      kind = f.kind;
    if (f.kind === "manor-takeover-completed" && characterId === "marietta") kind = f.kind;
    if (!kind) continue;
    const outcome =
      kind === "expedition-finished" || kind === "expedition-settled";
    if (outcome) kind = "expedition-result";
    const key = outcome
      ? `${runId}:result`
      : `${f.source.revision}:${f.encounterId}:${kind}`;
    const previous = grouped.get(key);
    if (previous) {
      previous.sourceFactIds.push(f.id);
      if (!outcome) {
        previous.count++;
        previous.amount += typeof p.applied === "number" ? p.applied : 0;
      }
      continue;
    }
    grouped.set(key, {
      id: f.id,
      sourceFactIds: [f.id],
      runId,
      encounterId: f.encounterId,
      worldTime: { ...f.worldTime },
      kind,
      count: 1,
      amount: typeof p.applied === "number" ? p.applied : 0,
      ...(typeof p.layer === "number" ? { layer: p.layer } : {}),
      ...(typeof p.wiped === "boolean" ? { wiped: p.wiped } : typeof p.outcome === "string" ? {wiped: p.outcome === "wipe"} : {}),
    });
  }
  return [...grouped.values()];
}
