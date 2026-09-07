// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { growthStories, teamMilestoneStory } from "./growth-stories";

it("transcribes all 70 approved growth, gift and milestone lines without changing speakers or text", () => {
  const approved = readFileSync("docs/archive/design/DEMO_D5_A_STORY_SCRIPT.md", "utf8").split("## 3. 十个成长片段")[1].split("## 6. 发布前核对")[0];
  const rows = [...approved.matchAll(/^\| \d{2} \| (.*?) \| (.*?) \|$/gm)].map(m => ({name:m[1], text:m[2]}));
  const stories = [...Object.values(growthStories),teamMilestoneStory];
  expect(rows).toHaveLength(70);
  expect(stories.flatMap(s => s.lines.map(({name,text}) => ({name,text})))).toEqual(rows);
  expect(new Set(stories.flatMap(s => s.lines.map(l => l.id))).size).toBe(70);
});
