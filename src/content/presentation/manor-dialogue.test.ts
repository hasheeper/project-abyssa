import { expect, it } from "vitest";
import { manorJourneyDialogue, type ManorScene } from "./manor-journey-dialogue";
import { clockworkMemoryScript } from "./clockwork-memory";
import { manorConclusionDialogue, manorConclusionForParty } from "./manor-conclusion";

it("keeps memory checkpoint lengths and stable IDs while revising the prose", () => {
  expect(Object.values(clockworkMemoryScript).map(lines=>lines.length)).toEqual([8,9,6,9,8]);
  for(const [node,lines] of Object.entries(clockworkMemoryScript)) {
    expect(lines.map(line=>line.id)).toEqual(lines.map((_,i)=>`story.marietta.clockwork.${node}.${i+1}`));
  }
  expect(manorConclusionDialogue).toHaveLength(5);
});
it("keeps absent expedition companions out of the ending without moving saved checkpoints", () => {
  const lines = manorConclusionForParty(["kael", "norma"]);
  expect(lines.map(step => step.map(line => line.id))).toEqual(manorConclusionDialogue.map(step => step.map(line => line.id)));
  expect(new Set(lines.flat().flatMap(line => line.characterId ? [line.characterId] : []))).toEqual(new Set(["kael", "marietta"]));
  expect(manorConclusionForParty(["kael", "eustice", "elora"])).toEqual(manorConclusionDialogue);
});
it("party substitutions use the present actor's authored voice, including the real event participant", () => {
  const scenes: ManorScene[] = ["register-intro","seats-intro","relic-intro","register-read","seats-read","relic-kept","relic-lost","exit"];
  for(const member of ["eustice","elora","kororo","norma","marietta"]) {
    for(const scene of scenes) {
      const party=["kael",member], lines=manorJourneyDialogue(scene,party,member,true);
      expect(lines).toHaveLength(3);
      expect(lines.flatMap(l=>l.characterId?[l.characterId]:[]).every(id=>party.includes(id))).toBe(true);
      expect(lines[1].characterId).toBe(member);
    }
  }
  const norma=manorJourneyDialogue("register-intro",["kael","norma"],null,true)[1];
  const kororo=manorJourneyDialogue("register-intro",["kael","kororo"],null,true)[1];
  expect(norma.text).not.toBe(kororo.text);
  expect(manorJourneyDialogue("relic-kept",["kael","norma"],"kael",true)[2].characterId).toBeUndefined();
});
