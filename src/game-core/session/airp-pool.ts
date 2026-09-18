import type { AirpCard, AirpHead, AirpPhase, AirpPoolContent, AirpPoolInstance, AirpPoolState } from "../contracts";
import { AIRP_LIMITS, canonicalJson, measureAirpCapacity, sha256 } from "../contracts";

export const emptyAirpPool = (): AirpPoolState => ({ version: 2, instances: [], scenes: [], reading: null, memories: [], cooldowns: [], reserve: [], daily: { day: 0, offers: 0 }, nextForm: 0, lastBoundaryId: null, capacityStopped: false });
export const airpPoolActive = (i: AirpPoolInstance) => i.status !== "closed" && i.status !== "resolved";
export function airpActorLocation(content: AirpPoolContent, actorId: string, phase: AirpPhase, available: readonly string[], atHome: boolean): string | null {
  return atHome && available.includes(actorId) ? content.availability[actorId]?.[phase] ?? null : null;
}
export function airpPoolReadingInstance(state: AirpPoolState) {
  const scene = state.scenes.find(s => s.id === state.reading?.sceneId);
  return state.instances.find(i => i.id === scene?.instanceId) ?? null;
}
export function airpPoolLocked(state: AirpPoolState): boolean {
  const r = state.reading, i = airpPoolReadingInstance(state);
  return !!r && !r.paused && (!r.completed || !!i && (i.status === "ready" && i.returnSceneId === r.sceneId || i.status === "offered"));
}
export function poolCooldown(state: AirpPoolState, card: AirpCard, phase: number, factId: string) {
  state.cooldowns.push({ themeKey: card.themeKey, sourceFactId: factId, fromPhase: phase, untilPhase: phase + card.cooldownPhases });
}
/** Draft-only mutations. Clock and fact identity must come from validated replay. */
export function expireAirpPool(content: AirpPoolContent, state: AirpPoolState, phase: number, head: AirpHead, factId: string) {
  for (const i of state.instances) {
    if (!["pending", "offered"].includes(i.status) || phase < i.offerUntilPhase) continue;
    const card = content.cards.find(d => d.id === i.definition.id)!;
    i.status = "closed"; i.closedPhase = phase;
    i.reason = card.volatility === "consequential" ? "missed" : i.exposedPhase === null ? "reserved" : "expired-seen";
    if (airpPoolReadingInstance(state)?.id === i.id) state.reading = null;
    if (i.reason === "reserved") {
      state.reserve = state.reserve.filter(r => r.definition.id !== card.id);
      state.reserve.push({ definition: i.definition, sourceInstanceId: i.id, eligiblePhase: (Math.floor(phase / 4) + 1) * 4 });
    } else {
      poolCooldown(state, card, phase, factId);
      if (i.reason === "missed") state.memories.push({ id: `aftermath:${sha256(i.id).slice(0, 32)}`, axis: "agenda", phase, source: { ...head }, sourceFactIds: [factId], topicKeys: [...card.tags], knowledge: { kind: "public" }, summary: card.aftermath! });
    }
  }
}
/** Fair four-form rotation; no battle RNG, wall clock, or render-time writes. */
export function scheduleAirpPool(content: AirpPoolContent, state: AirpPoolState, input: {
  phase: number; phaseName: AirpPhase; head: AirpHead; factId: string; eligible: boolean; availableActorIds: readonly string[]; setback: boolean;
}): void {
  if (!input.eligible || airpPoolLocked(state) || state.lastBoundaryId === input.factId) return;
  // A proven patrol return takes scheduling priority, but it is NOT an active
  // reading until its own return scene has been deliberately opened.
  if (state.instances.some(i => i.status === "ready" && content.cards.find(d => d.id === i.definition.id)!.objective.form === "sortie")) return;
  state.lastBoundaryId = input.factId;
  const day = Math.floor(input.phase / 4) + 1;
  if (state.daily.day !== day) state.daily = { day, offers: 0 };
  const open = () => state.instances.filter(airpPoolActive);
  for (let attempt = 0; attempt < 4 && state.daily.offers < content.scheduler.dailyOffers && open().length < content.scheduler.maxOpen; attempt++) {
    const form = content.scheduler.formOrder[state.nextForm]; state.nextForm = (state.nextForm + 1) % 4;
    if (open().some(i => content.cards.find(c => c.id === i.definition.id)!.objective.form === form)) continue;
    if (state.instances.length >= AIRP_LIMITS.instances || state.scenes.length + (open().length + 1) * 8 > AIRP_LIMITS.sceneCount || state.memories.length + open().length + 1 >= AIRP_LIMITS.memories) { state.capacityStopped = true; return; }
    const candidates = content.cards.filter(d => d.objective.form === form
      && d.actorIds.every(a => input.availableActorIds.includes(a))
      && airpActorLocation(content, d.giverId, input.phaseName, input.availableActorIds, true)
      && !open().some(i => content.cards.find(c => c.id === i.definition.id)!.themeKey === d.themeKey)
      && !state.cooldowns.some(c => c.themeKey === d.themeKey && c.untilPhase > input.phase)
      && !(d.repeat === "once" && state.instances.some(i => i.definition.id === d.id && (i.status === "resolved" || i.reason === "missed")))
      && !state.reserve.some(r => r.definition.id === d.id && r.eligiblePhase > input.phase));
    // Least-issued first: an unseen reserve must not starve fresh authored cards.
    candidates.sort((a, b) => state.instances.filter(i => i.definition.id === a.id).length - state.instances.filter(i => i.definition.id === b.id).length || content.cards.indexOf(a) - content.cards.indexOf(b));
    const card = candidates[0]; if (!card) continue;
    const reserve = state.reserve.find(r => r.definition.id === card.id);
    const id = `ripple:${sha256(canonicalJson([input.head, card.id, state.instances.length])).slice(0, 32)}`;
    state.instances.push({ id, definition: { id: card.id, version: card.version }, createdPhase: input.phase, offerUntilPhase: input.phase + card.offerPhases,
      actorIds: [...card.actorIds], status: "pending", variant: reserve ? "reserve" : input.setback && form === "sortie" ? "setback" : "initial", exposedPhase: null,
      accepted: null, binding: null, carryFactId: null, proof: null, completionFactIds: [], returnSceneId: null, targetSceneId: null,
      closedPhase: null, reason: null, resolvedPhase: null, receiptId: null, aftermathRead: false });
    state.reserve = state.reserve.filter(r => r.definition.id !== card.id);
    state.daily.offers++;
  }
}
export function checkAirpPoolCapacity(state: AirpPoolState) {
  // This is a storage guard, not a parser: source=rp is admitted only by content10's evidence replay.
  return measureAirpCapacity({ instances: state.instances, scenes: state.scenes, memories: state.memories, jobs: [], metadata: { reserve: state.reserve, cooldowns: state.cooldowns, daily: state.daily, nextForm: state.nextForm, lastBoundaryId: state.lastBoundaryId, reading: state.reading, capacityStopped: state.capacityStopped } }, state.scenes.some(s => s.source === "rp") ? 48 * 1024 : AIRP_LIMITS.sceneBytes);
}
