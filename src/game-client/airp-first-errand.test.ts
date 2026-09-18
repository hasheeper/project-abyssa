import { describe, expect, it } from "vitest";
import { FIRST_AIRP_OPTION_STANCES, FIRST_AIRP_PATROL_CUES, FIRST_AIRP_STORIES } from "../content/presentation/airp/first-errand";
import { FIRST_AIRP_ERRAND } from "../content/gameplay/airp-v1/first-errand";
import { parseAvgStory, type AvgChoice } from "../shared/domain/avg/story";
import { compileAvgStory } from "../shared/domain/avg/playback";
import { avgPresentation } from "./avg-assets";

describe("AIRP first errand authored fallback (isolated preview)", () => {
  it("has every referenced scene/cue and only registered preview assets", () => {
    const ids = [...Object.values(FIRST_AIRP_STORIES), ...Object.values(FIRST_AIRP_PATROL_CUES)].map(s => s.id);
    expect(ids.sort()).toEqual(Object.values(FIRST_AIRP_ERRAND.scenes).sort());
    for (const story of Object.values(FIRST_AIRP_STORIES)) {
      expect(parseAvgStory(story)).toEqual(story);
      expect(avgPresentation(story).background).toBeTruthy();
      expect(story.player.authoredSpeech).toBe(false);
      const frames = story.nodes.flatMap(n => n.kind === "beat" ? n.frames : n.kind === "branch" ? Object.values(n.variants).flat() : []);
      expect(frames.some(f => f?.kind === "dialogue" && f.actorId === "kael")).toBe(false);
      expect(new TextEncoder().encode(JSON.stringify(story)).length).toBeLessThan(16 * 1024);
    }
  });
  it.each(["A", "B", "C"] as AvgChoice[])("compiles only the selected %s response, with no extra player speech", choice => {
    const s = FIRST_AIRP_STORIES.offer, compiled = compileAvgStory(s), choiceStep = s.nodes.findIndex(n => n.kind === "choice");
    const transcript = compiled.transcript(s.nodes.length - 1, [{ step: choiceStep, choice }]);
    const responses = transcript.filter(n => n.id.startsWith(`${s.id}.response`));
    expect(responses).toHaveLength(1);
    expect(responses[0].id).toBe(`${s.id}.response.${choice}`);
    expect(FIRST_AIRP_OPTION_STANCES[choice]).toBeTruthy();
  });
  it("keeps the two return outcomes distinct and the no-Elora patrol cues narration-only", () => {
    expect(FIRST_AIRP_STORIES["return-extracted"].id).not.toBe(FIRST_AIRP_STORIES["return-cleared"].id);
    expect(Object.values(FIRST_AIRP_PATROL_CUES).every(c => !Object.hasOwn(c, "actorId"))).toBe(true);
  });
});
