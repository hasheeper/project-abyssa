import type { D5GameRecord } from "../versions/d5-contracts";
import { projectD5SettlementBoundary } from "../airp-settlement/d5-source";
import { gameGrants } from "./policy";
import { recordMemoryContext } from "../airp-memory/d5";

export type HomeBoundary = { factId: string; kind: "action" | "event"; eventId: string; actorIds: string[]; title: string };
/** Derived from complete read/decline commands. Generation alone never creates a checkpoint. */
export function pendingHomeBoundary(r: D5GameRecord): HomeBoundary | null {
  if (!r.airpGame || !r.airpDirector) return null;
  for (const f of r.facts) {
    if (f.kind !== "airp-director" || r.retractedFactIds.includes(f.id) || r.airpGame.settlement.jobs.some(j => j.status === "applied" && j.frames.at(-1)!.input.scope.boundaryId === f.id)) continue;
    const c = f.payload.command;
    if (c.type === "airp-director-decline") {
      const e = r.airpDirector.events.find(e => e.id === c.eventId)!;
      if (r.airpDirector.jobs.some(j => j.scene?.eventId === e.id && j.scene.role === "declined" && (j.lowContextVersion ?? 0) >= 11)) continue;
      return { factId: f.id, kind: "event", eventId: e.id, actorIds: e.card.actorIds, title: e.card.title };
    }
    if (c.type !== "airp-director-read") continue;
    const j = r.airpDirector.jobs.find(j => j.id === c.jobId);
    if (!j?.text || !j.scene || c.cursor !== j.text.lines.length - 1 || !["feedback", "result", "followup", ...((j.lowContextVersion ?? 0) >= 11 ? ["declined"] : [])].includes(j.scene.role)) continue;
    if ((j.lowContextVersion ?? 0) >= 11 && !j.lowPhase?.complete) continue;
    const e = r.airpDirector.events.find(e => e.id === j.scene!.eventId)!;
    if (!e.readSceneIds.includes(j.id)) continue;
    return { factId: f.id, kind: j.scene.role === "feedback" ? "action" : "event", eventId: e.id, actorIds: j.scene.actorIds, title: e.card.title };
  }
  return null;
}
export function homeSettlementPacket(r: D5GameRecord, b: HomeBoundary) {
  const s = r.airpGame!;
  const boundary = r.facts.find(f => f.id === b.factId);
  const command = boundary?.kind === "airp-director" ? boundary.payload.command : null;
  const scene = command?.type === "airp-director-read" ? r.airpDirector?.jobs.find(j => j.id === command.jobId)
    : [...(r.airpDirector?.jobs ?? [])].reverse().find(j => j.scene?.eventId === b.eventId && j.scene.role === "offer" && j.text);
  // Reuse the exact world entries activated for this scene, not EVERY worldbook chapter.
  // Full text/digests remain unchanged; old frozen settlement frames are not rebuilt.
  const sources = scene?.lowFrame?.sources ?? s.material.sources;
  const cards = sources.filter(d => d.kind === "character" && b.actorIds.includes(d.id)).map(d => ({ actorId: d.id, text: d.text, digest: d.sha256 }));
  const world = sources.filter(d => d.kind === "world" || d.kind === "player").map(d => ({ id: d.id, text: d.text, digest: d.sha256, triggerIds: [b.factId] }));
  const packet = projectD5SettlementBoundary({ record: { ...r, head: s.worldHead }, ledger: s.settlement, boundary: b,
    grants: gameGrants(s.settlement, b.actorIds, b.factId, b.eventId, b.kind === "event", true), cards, world });
  const memoryView = recordMemoryContext(r);
  if (memoryView) packet.materials.memoryView = memoryView;
  return packet;
}
