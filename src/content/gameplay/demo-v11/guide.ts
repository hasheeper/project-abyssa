import type { TutorialGuideDefinition, TutorialGuideEvidence, TutorialGuideInput, TutorialGuideStep, TutorialGuideTarget } from "../../../game-core/contracts";

const enemy = (name: string, ordinal = 0): TutorialGuideTarget => ({kind: "enemy", definitionId: `enemy.intro.${name}`, ordinal});
const member = (id: string): TutorialGuideTarget => ({kind: "member", id});
const t1 = "room.tide-cave.1", t2 = "room.tide-cave.2", e1 = "room.tide-cave.event.intro", t3 = "room.tide-cave.3";
const steps: TutorialGuideStep[] = [];
function add(id: string, roomId: string, round: number | null, input: TutorialGuideInput, evidence: TutorialGuideEvidence[]) {
  steps.push({id, roomId, round, input, evidence, instructionId: `guide.${id}`});
}
function roll(id: string, room: string, round: number) { add(id, room, round, {kind: "roll"}, [{type: "dice-rolled", payload: {reroll: false}}]); }
function fix(id: string, room: string, round: number, actorId: string) { add(id, room, round, {kind: "fix", actorId}, [{type: "die-fixed", actorId, payload: {loaded: true}}]); }
function act(id: string, room: string, round: number, actorId: string, choice: "attack" | "guard" | "heal", target: TutorialGuideTarget, amount: number, alreadyFixed = false) {
  if (!alreadyFixed) fix(`${id}.fix`, room, round, actorId);
  add(id, room, round, {kind: "act", actorId, choice, target}, [{type: choice === "attack" ? "damage-applied" : choice === "guard" ? "guard-applied" : "healing-applied", actorId, payload: {[choice === "guard" ? "amount" : "applied"]: amount}}]);
}
function end(id: string, room: string, round: number) { add(id, room, round, {kind: "end-turn"}, [{type: "hand-settled"}]); }
function story(id: string, room: string, storyId: string) { add(id, room, null, {kind: "story", storyId}, [{type: "tutorial-story-read", payload: {storyId}}]); }
function advance(id: string, room: string, event = false) { add(id, room, null, {kind: "advance"}, [{type: event ? "tutorial-node-entered" : "encounter-started"}]); }

// G1's verified commands, with semantic targets instead of fixture instance IDs.
story("T1.arrival", t1, "S3-1");
roll("T1.R1.roll", t1, 1);
act("T1.R1.kael", t1, 1, "kael", "attack", enemy("tide-slime"), 1);
act("T1.R1.eustice", t1, 1, "eustice", "attack", enemy("tide-slime"), 2);
end("T1.R1.end", t1, 1);
add("T1.R1.hit", t1, 1, {kind: "automatic"}, [{type: "damage-applied", payload: {targetKind: "party-member", targetId: "eustice", applied: 1}}]);
roll("T1.R2.roll", t1, 2);
act("T1.R2.eustice", t1, 2, "eustice", "attack", enemy("tide-slime", 1), 3);
story("T1.interlude", t1, "S3-2"); advance("T2.enter", t1);
roll("T2.R1.roll", t2, 1); fix("T2.R1.keep", t2, 1, "eustice");
add("T2.R1.reroll", t2, 1, {kind: "reroll"}, [{type: "dice-rolled", payload: {reroll: true}}]);
act("T2.R1.eustice", t2, 1, "eustice", "attack", enemy("lookout"), 2, true);
act("T2.R1.kael.heal", t2, 1, "kael", "heal", member("eustice"), 1);
end("T2.R1.end", t2, 1);
roll("T2.R2.roll", t2, 2);
act("T2.R2.guard-bow", t2, 2, "eustice", "guard", enemy("crossbowman"), 2);
act("T2.R2.kill-knife", t2, 2, "kael", "attack", enemy("lookout"), 1);
act("T2.R2.kororo.attack", t2, 2, "kororo", "attack", enemy("crossbowman"), 4);
end("T2.R2.end", t2, 2);
add("T2.R2.arrow", t2, 2, {kind: "automatic"}, [{type: "damage-applied", payload: {targetKind: "party-member", targetId: "eustice", applied: 0}}]);
roll("T2.R3.roll", t2, 3);
act("T2.R3.finish", t2, 3, "eustice", "attack", enemy("crossbowman"), 1);
story("T2.interlude", t2, "S3-3");
add("S3-3.food", t2, null, {kind: "item", definitionId: "item.food", actorId: "kororo"}, [{type: "healing-applied", payload: {targetId: "kororo", applied: 1}}, {type: "item-used", payload: {remaining: 3}}]);
advance("E1.enter", t2, true);
add("E1.attempt", e1, null, {kind: "event", actorId: "elora"}, [{type: "event-resolved", actorId: "elora", payload: {method: "strong", cost: 0, reward: 0}}, {type: "room-completed"}]);
add("E1.result", e1, null, {kind: "observe-result"}, [{type: "tutorial-observed", payload: {stepId: "E1.result"}}]);
advance("T3.enter", e1);
roll("T3.R1.roll", t3, 1);
act("T3.R1.focus.kael", t3, 1, "kael", "attack", enemy("lookout"), 1);
act("T3.R1.focus.eustice", t3, 1, "eustice", "attack", enemy("lookout"), 2);
act("T3.R1.kororo.attack", t3, 1, "kororo", "attack", enemy("crossbowman"), 4);
act("T3.R1.norma.guard", t3, 1, "norma", "guard", enemy("hauler"), 2);
add("T3.R1.end", t3, 1, {kind: "end-turn"}, [{type: "hand-settled", payload: {name: "两对"}}, {type: "covenant-triggered", actorId: "norma"}, {type: "damage-applied", actorId: "norma", payload: {targetKind: "enemy", applied: 1}}]);

export const TIDE_GUIDE: TutorialGuideDefinition = {
  version: 1, id: "tide.guide.v1", continuationSeed: 11395852,
  nodes: [
    {roomId: t1, battle: 1, storyAfter: "S3-2"}, {roomId: t2, battle: 2, storyAfter: "S3-3"},
    {roomId: e1, battle: null, storyAfter: null}, {roomId: t3, battle: 3, storyAfter: "S3-4"},
    {roomId: "room.tide-cave.4", battle: 4, storyAfter: null},
  ],
  steps,
};
