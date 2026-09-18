import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { D5JourneyOperation } from "../../../game-core/session/d5-journey-contracts";
import { tutorialOperationAllowed } from "../../../game-runtime/tutorial-view";
import copy from "../../../content/presentation/tutorial/guided-tide.json";

/** Only mirrors the queried restriction. Original command legality still belongs to the core. */
export function tideGuideAllows(view: DemoJourneyView, operation: D5JourneyOperation) {
  return tutorialOperationAllowed(view.tutorial, operation);
}

export type TideGuideDraft = {heldActor: string | null; eventActorId?: string; suppliesOpen?: boolean; selectedItem?: string | null};
type GuidePresentation = {
  id: string; title: string; text: string; targets: string[]; contextTargets: string[];
  acknowledge: boolean; actionLabel?: string;
};
const enemyAliases: Record<string, [string, number]> = {
  "slime-left": ["tide-slime", 0], "slime-right": ["tide-slime", 1],
  knife: ["lookout", 0], bow: ["crossbowman", 0], hauler: ["hauler", 0],
};
/** Copy uses semantic enemies; the currently displayed encounter owns instance IDs. */
function resolveTargets(v: DemoJourneyView, refs: readonly string[]) {
  return refs.flatMap(ref => {
    if (ref.startsWith("battle.")) return [ref];
    const [kind, alias] = ref.split(":"), definition = enemyAliases[alias];
    if (!definition || !["enemy", "enemy-health", "intent"].includes(kind)) return [];
    const enemy = v.battle?.enemies.filter(e => e.definitionId === `enemy.intro.${definition[0]}`)[definition[1]];
    return enemy ? [`battle.${kind}:${enemy.id}`] : [];
  });
}

/** Short, read-only scene orientation. No new guide command or gameplay checkpoint. */
export function guidedTideObservation(v: DemoJourneyView, read: (id: string) => number): GuidePresentation | null {
  const t = v.tutorial, guide = t?.guide;
  if (!t?.runRef || !t.hintsEnabled || t.stage !== "active" || !guide) return null;
  let key: keyof typeof copy.observations | undefined;
  if (guide.mode === "guided") {
    const checkpoints: Record<string, keyof typeof copy.observations> = {
      "T1.R1.roll": "slimes", "T2.R1.roll": "sentries", "T2.R2.roll": "bowReady",
      "E1.attempt": "event", "T3.R1.roll": "haulers",
    };
    key = checkpoints[guide.step?.id ?? ""];
    if (guide.step?.id === "T3.R1.focus.kael.fix" && v.battle?.hand?.name === "两对") key = "twoPairs";
  } else if (guide.reason === "completed" && v.battle?.phase === "roll") {
    if (t.encounter === 3 && v.battle.encounter.round === 2) key = "pairResult";
    if (t.encounter === 4 && v.battle.encounter.round === 1) key = "boss";
  }
  if (!key) return null;
  const id = `guided.observe.${key}:${t.runRef.id}:${t.attempt}`;
  if (read(id)) return null;
  const entry = copy.observations[key], targets = resolveTargets(v, entry.targets);
  if (!targets.length) return null;
  return {id, title: entry.title, text: entry.text, targets,
    contextTargets: resolveTargets(v, "contextTargets" in entry ? entry.contextTargets : []),
    acknowledge: true, actionLabel: entry.actionLabel};
}
/** Local selection changes the focus, never the authoritative step or its proof. */
export function guidedTideModel(v: DemoJourneyView, draft: TideGuideDraft) {
  const t = v.tutorial, guide = t?.guide, step = guide?.step, op = guide?.operation;
  if (!t?.hintsEnabled || t.stage !== "active" || guide?.mode !== "guided" || !step || !op) return null;
  const make = (key: keyof typeof copy.steps, targets: string[]): GuidePresentation => {
    const entry = copy.steps[(copy.instructions as Partial<Record<string, keyof typeof copy.steps>>)[`${step.instructionId}.${key}`] ?? key];
    return {
      id: `guided.${step.id}.${key}`, title: entry.title, text: entry.text, targets,
      contextTargets: resolveTargets(v, "contextTargets" in entry ? entry.contextTargets : []), acknowledge: false,
    };
  };
  if (op.type === "battle") {
    const c = op.command;
    if (c.type === "roll") return make("roll", ["battle.roll"]);
    if (c.type === "reroll") return make("reroll", ["battle.reroll"]);
    if (c.type === "toggle-load") return make("fix", [`battle.die:${c.actorId}`]);
    if (c.type === "end-turn") return make("end", ["battle.end-turn"]);
    if (c.type === "act") {
      if (draft.heldActor !== c.actorId) return make("actor", [`battle.member:${c.actorId}`]);
      if (c.choice === "guard") return make("guard", [`battle.intent:${c.targetId}`]);
      if (c.choice === "heal") return make("heal", [`battle.member:${c.targetId}`]);
      return make("attack", [`battle.enemy:${c.targetId}`]);
    }
  }
  if (op.type === "item") {
    if (!draft.suppliesOpen) return make("items", ["battle.items"]);
    if (draft.selectedItem !== op.instanceId) return make("food", [`battle.item:${op.instanceId}`]);
    return make("foodTarget", [`battle.item-target:${op.instanceId}`]);
  }
  if (op.type === "event") return draft.eventActorId !== op.actorId
    ? make(guide.planId === "tide.guide.v2" ? "locksmithParticipant" : "participant", [`battle.member:${op.actorId}`]) : make("event", ["battle.event-confirm"]);
  if (op.type === "tutorial-observe") return make("result", ["battle.event-observe"]);
  if (op.type === "advance") return make("advance", ["battle.advance"]);
  return null;
}
