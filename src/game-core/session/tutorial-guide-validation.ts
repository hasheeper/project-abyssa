import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5BaseExpeditionState } from "./d5-types";
import type { TutorialGuideState } from "./tutorial-types";
import * as v from "../contracts/validation";
import { drawRngValue } from "../battle/persistence/rng";

export function readTutorialGuide(catalog: ValidatedD5Catalog, raw: unknown, base: D5BaseExpeditionState, attempt: number): TutorialGuideState {
  const plan = catalog.data.tutorial!.guide!, g = v.record(raw, "guide", ["version", "planId", "mode", "reason", "cursor", "proofs", "exitEventId"]);
  v.choice(g.version, [1], "guide.version"); v.choice(g.planId, [plan.id], "guide.planId");
  const cursor = v.number(g.cursor, "guide.cursor", 0, plan.steps.length);
  const mode = v.choice(g.mode, ["guided", "free"], "guide.mode");
  if (mode === "guided" ? g.reason !== null || cursor === plan.steps.length || g.exitEventId !== null : g.reason === "completed" ? cursor !== plan.steps.length || g.exitEventId !== null : g.reason !== "exited" || cursor === plan.steps.length || g.exitEventId === null) v.invalid("guide.mode", "Mode and completion reason disagree");
  const eventNumber = (raw: unknown) => {
    const id = v.id(raw, "guide.eventId"), prefix = `${base.run.id}:event:`;
    const n = Number(id.slice(prefix.length));
    if (!id.startsWith(prefix) || !Number.isSafeInteger(n) || n < 1 || n > base.run.sequence || id !== `${prefix}${n}`) v.invalid("guide.eventId", "Foreign or future proof");
    return n;
  };
  if (g.exitEventId !== null) eventNumber(g.exitEventId);
  const proofs = v.list(g.proofs, "guide.proofs", plan.steps.length);
  if (proofs.length !== cursor) v.invalid("guide.cursor", "Only a contiguous proven prefix can advance the guide");
  let previousEvent = 0;
  proofs.forEach((raw, index) => {
    const p = v.record(raw, "guide.proof", ["stepId", "roomId", "encounterId", "attempt", "eventIds"]), step = plan.steps[index];
    const nodeIndex = plan.nodes.findIndex(n => n.roomId === step.roomId), node = plan.nodes[nodeIndex];
    if (p.stepId !== step.id || p.roomId !== base.run.roomIds[0][nodeIndex] || p.encounterId !== (node.battle ? `${base.run.id}:encounter:${node.battle}` : null)) v.invalid("guide.proof", "Step/room/encounter mismatch");
    v.number(p.attempt, "guide.proof.attempt", 1, attempt);
    const ids = v.ids(p.eventIds, "guide.proof.eventIds", 8);
    if (!ids.length) v.invalid("guide.proof", "Empty proof");
    for (const id of ids) { const n = eventNumber(id); if (n <= previousEvent) v.invalid("guide.proof", "Proofs must follow committed event order"); previousEvent = n; }
  });
  return structuredClone(raw) as TutorialGuideState;
}

/** Extra v11 invariants; earlier readers and their published digests stay unchanged. */
export function validateGuidedJourney(catalog: ValidatedD5Catalog, base: D5BaseExpeditionState, continuationSeed: unknown) {
  const plan = catalog.data.tutorial!.guide!;
  if (continuationSeed !== plan.continuationSeed || base.run.rng.combat.seed !== (base.run.room === 0 ? catalog.data.tutorial!.firstBattleSeed : plan.continuationSeed)) v.invalid("guide.seed", "Tutorial seed is owned by its content release");
  const eventIndex = plan.nodes.findIndex(n => n.battle === null), roomId = base.run.roomIds[0][eventIndex];
  const results = base.run.eventResults.filter(e => e.roomId === roomId);
  if (base.run.eventResults.length !== results.length || results.length !== (base.run.completedRoomIds.includes(roomId) ? 1 : 0)) v.invalid("guide.event", "A completed event room needs one unique result");
  const result = results[0];
  if (result?.choiceId === "attempt") {
    const member = base.run.party.find(m => m.id === result.actorId)!;
    const draw = drawRngValue({algorithm: "mulberry32", seed: plan.eventSeed ?? ((plan.continuationSeed ^ 0x3c6ef372) >>> 0), cursor: 0});
    if (member.config.faces[Math.floor(draw.value * 6)].id !== result.faceId) v.invalid("guide.event.face", "Event face differs from its unique independent draw");
  }
}
