// @vitest-environment node
import { expect, it } from "vitest";
import { isUserChoice } from "./authored-story";
import { growthStories, teamMilestoneStory } from "./growth-stories";

it("keeps the six-step reward cursors while giving every growth scene one player decision", () => {
  const stories=Object.values(growthStories);
  expect(stories).toHaveLength(11);
  expect(stories.every(story=>story.lines.length===6)).toBe(true);
  expect(teamMilestoneStory.lines).toHaveLength(4);
  const all=[...stories,teamMilestoneStory].flatMap(story=>story.lines);
  expect(new Set(all.map(line=>line.id)).size).toBe(70);
  for(const story of stories) {
    const choices=story.lines.filter(isUserChoice);
    expect(choices).toHaveLength(1);
    expect(choices[0].options.map(option=>option.tone)).toEqual(["iron","seasoned","pragmatic"]);
    expect(choices[0].options.every(option=>option.action.length>0 && (!option.line || option.line.length<=12))).toBe(true);
  }
});

it("never authors the compatibility actor as an automatic speaker", () => {
  const stories=[...Object.values(growthStories),teamMilestoneStory];
  const all=stories.flatMap(story=>story.lines);
  expect(all.some(line=>line.characterId==="kael")).toBe(false);
  expect(JSON.stringify(stories)).not.toContain("凯尔");
  expect(JSON.stringify(stories)).toContain("{{user}}");
});
