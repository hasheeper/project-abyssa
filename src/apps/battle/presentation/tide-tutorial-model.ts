import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { battleTutorialModel } from "./battle-tutorial-model";
import copy from "../../../content/presentation/tutorial/tide-cave.json";
import { guidedTideModel, guidedTideObservation, type TideGuideDraft } from "./guided-tide-model";

/** Optional guidance follows real legal options and rollback-aware evidence, never a scripted roll. */
export function tideTutorialModel(v: DemoJourneyView, heldActor: string | null, read: (id: string) => number, draft?: TideGuideDraft) {
  if (v.tutorial?.guide) return guidedTideObservation(v, read) ?? guidedTideModel(v, draft ?? {heldActor});
  const t = v.tutorial, b = v.battle;
  if (!t?.runRef || !t.hintsEnabled || t.stage !== "active") return null;
  const has = (kind: string) => t.lessons.some(l => l.kind === kind);
  const make = (key: keyof typeof copy.steps, target: string, acknowledge = true) => ({id: `tide.${key}`, ...copy.steps[key], targets: [target], acknowledge});
  if (t.encounter! <= 2 && b && ["roll", "act"].includes(b.phase) && ["roll", "fix", "action", "end-turn"].some(k => !has(k))) {
    // Reuse the live operation model, including alternate legal targets and no-action rerolls.
    return battleTutorialModel(v, heldActor, true, b.encounter.round);
  }
  if (heldActor && b?.phase === "act" && t.encounter! < 4) return battleTutorialModel(v, heldActor, true, b.encounter.round);
  if (!read("tide.recovery") && !has("heal") && !has("item") && v.supplies.some(s => s.targets.some(target => target.kind === "member"))) return make("recovery", "battle.items");
  if (t.encounter! >= 3) {
    if (has("hand") && !read("tide.hand")) return make("hand", "battle.ledger");
    if (has("covenant") && !read("tide.covenant")) return make("covenant", "battle.ledger");
  }
  if (t.encounter! >= 4 || b?.phase !== "act") return null;
  if (!has("reroll") && b.encounter.rerolls > 0 && b.eligibleOwnerIds.length && v.party.some(m => m.die?.loaded && !m.die.spent) && !read("tide.reroll")) return make("reroll", "battle.reroll");
  if (!has("guard") && !read("tide.guardFix")) {
    const guard = v.party.find(m => m.afterFixOptions.some(o => o.choice === "guard" && b.enemies.some(e => e.id === o.targetId && e.hp > 0 && e.damage > 0)));
    if (guard) return make("guardFix", `battle.die:${guard.id}`);
  }
  return null;
}
