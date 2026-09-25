import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { DemoEvent } from "../../../game-core/battle";
import type { BattleReaction } from "./battle-reactions";
import copy from "../../../content/presentation/tutorial/tide-tactical.json";

function cue(v: DemoJourneyView, id: keyof typeof copy, evidence: string): BattleReaction | null {
  const line = copy[id];
  if (!v.tutorial?.guide || !v.party.some(m => m.id === line.actorId && m.hp > 0)) return null;
  return {...line, kind: line.kind as BattleReaction["kind"], key: `tide-g4:${v.tutorial.runRef!.id}:${v.tutorial.attempt}:${v.roomId}:${id}|${evidence}`};
}
/** Scene arrival only. Refresh/UNDO does not manufacture a new arrival or replay history. */
export function tideOpeningCue(v: DemoJourneyView) {
  const t = v.tutorial;
  if (!t?.guide || t.stage !== "active" || !v.battle || v.battle.encounter.round !== 1 || v.battle.encounter.phase !== "roll") return null;
  if (t.encounter === 1) return cue(v, "slimes", "arrival");
  if (t.encounter === 2) return cue(v, "sentries", "arrival");
  if (t.encounter === 3) return cue(v, "haulers", "arrival");
  if (t.encounter === 4) {
    const choice = t.choices.find(c => c.storyId === "S3-4")?.choice;
    return cue(v, choice === "B" ? "bossB" : choice === "C" ? "bossC" : "bossA", "arrival");
  }
  return null;
}

/** Call only on the matching visual impact/outcome, not when a batch is first received. */
export function tideImpactCue(v: DemoJourneyView, event: DemoEvent, events: readonly DemoEvent[]) {
  const t = v.tutorial, p = event.payload as Record<string, unknown>;
  if (!t?.guide) return null;
  const locksmith = v.contentRef.contentVersion >= 12;
  if (event.type === "event-resolved" && v.room?.id === "room.tide-cave.event.intro" && event.actorId === (locksmith ? "norma" : "elora") && p.cost === 0 && p.reward === 0) {
    const id = p.method === "strong" ? locksmith ? "locksmithStrong" : "eventStrong"
      : p.method === "weak" ? locksmith ? "locksmithWeak" : "eventWeak"
      : p.method === "failed" ? locksmith ? "locksmithFailed" : "eventFailed" : null;
    return id ? cue(v, id, event.id) : null;
  }
  if (t.encounter === 4) return null; // One opening, then let the player decide.
  const bow = v.battle?.enemies.find(e => e.definitionId === "enemy.intro.crossbowman");
  const knife = v.battle?.enemies.find(e => e.definitionId === "enemy.intro.lookout");
  if (t.encounter === 2 && v.battle?.encounter.round === 2) {
    if (event.type === "guard-applied" && event.actorId === "eustice" && p.enemyId === bow?.id && p.amount === 2 && bow?.intent?.kind === "attack" && (knife?.hp ?? 0) > 0)
      return cue(v, "guardBow", event.id);
    if (event.type === "damage-applied" && event.actorId === bow?.id && p.targetKind === "party-member" && p.targetId === "eustice" && p.applied === 0 && bow?.intent?.blocked === 2)
      return cue(v, "arrowBlocked", event.id);
  }
  if (t.encounter === 3 && v.battle?.encounter.round === 1 && event.type === "damage-applied" && event.actorId === "norma" && p.targetKind === "enemy" && p.applied === 1 && Number(p.hpAfter) > 0
    && events.some(e => e.type === "covenant-triggered" && e.actorId === "norma")
    && events.some(e => e.type === "hand-settled" && (e.payload as {name?: string}).name === "两对")) return cue(v, "throwingKnife", event.id);
  return null;
}

/** Tab-local presentation dedupe. Only cue identities; no commands, outcomes or game audit. */
export function tideCueMemory(scope: string, storage?: Pick<Storage, "getItem" | "setItem">) {
  const key = `abyssa:tide-cues:g4:${scope}`;
  let seen = new Set<string>();
  try {
    const stored: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
    if (Array.isArray(stored)) seen = new Set(stored.filter((v): v is string => typeof v === "string").slice(-64));
  } catch { /* Presentation still works if storage is unavailable. */ }
  return {take(next: BattleReaction | null) {
    const identity = next?.key.split("|")[0];
    if (!next || !identity || seen.has(identity)) return null;
    seen.add(identity);
    seen = new Set([...seen].slice(-64));
    try { storage?.setItem(key, JSON.stringify([...seen])); } catch { /* No gameplay dependency. */ }
    return next;
  }};
}
