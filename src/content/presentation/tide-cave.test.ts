import { expect, it } from "vitest";
import { TIDE_GUIDED_STORY, TIDE_STORY, tideStory } from "./tide-cave";
import copy from "./tutorial/guided-tide.json";
import tactical from "./tutorial/tide-tactical.json";
import { TIDE_GUIDE } from "../gameplay/demo-v11/guide";

it("keeps seven story slots and choice identities, isolating the old four-room prose", () => {
  expect(TIDE_GUIDED_STORY.nodes.map(n=>[n.id,n.cursor,n.kind])).toEqual(TIDE_STORY.nodes.map(n=>[n.id,n.cursor,n.kind]));
  expect(TIDE_GUIDED_STORY.player.authoredSpeech).toBe(false);
  for (const section of TIDE_GUIDED_STORY.sections) {
    expect(tideStory(section.id,"guided").lines.length).toBeGreaterThanOrEqual(5);
    expect(tideStory(section.id).lines.length).toBeLessThanOrEqual(3);
  }
  expect(tideStory("S3-4","guided").choice?.options).toEqual(tideStory("S3-4").choice?.options);
  const guided = JSON.stringify(TIDE_GUIDED_STORY);
  expect(guided).toContain("修缮还没有完成");
  expect(guided).toContain("何时出发，都由您决定");
  expect(guided).not.toMatch(/披着斗篷|已经领取|获得补给|全员满血|凯尔/);
  expect(TIDE_GUIDED_STORY.cast).toContain("abyssa");
  expect(TIDE_STORY.cast).not.toContain("abyssa");
});

it("resolves each progressive instruction and keeps dialogue separate from controls", () => {
  const ids = new Set(TIDE_GUIDE.steps.map(s=>s.instructionId));
  for (const [key,value] of Object.entries(copy.instructions)) {
    expect(ids.has(key.slice(0,key.lastIndexOf(".")))).toBe(true);
    expect(Object.hasOwn(copy.steps,value)).toBe(true);
  }
  for (const line of Object.values(tactical)) {
    expect(line.actorId).not.toBe("kael");
    expect(line.text).not.toMatch(/点击|按钮|ROLL|骰子|JSON/);
    expect(line.text).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
    expect([...line.text].length).toBeLessThanOrEqual(64);
  }
  expect([tactical.locksmithStrong.text,tactical.locksmithWeak.text,tactical.locksmithFailed.text]).toEqual([
    "……开了。里面没事，BOSS。",
    "……底下湿了。完好的东西带走就行。",
    "……啧，锈死了，水也灌进去了。撤吧，BOSS。",
  ]);
});
