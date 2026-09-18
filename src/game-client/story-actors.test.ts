import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { storyActors, storyAssets, storyMessages, storySlots } from "./story-actors";
import { tideStory } from "../content/presentation/tide-cave";
import type { AuthoredLine } from "../content/presentation/authored-story";

it("keeps silent actor directions once, without turning production notes into dialogue", () => {
  const lines: AuthoredLine[] = [{id:"quiet",text:"海风停了。",actors:[{characterId:"norma",emotion:"serious",direction:"蹲下检查铜锁"}]}];
  expect(storyActors(lines).map(actor=>actor.id)).toEqual(["norma"]);
  expect(storyMessages(lines)).toEqual([
    {id:"quiet.stage.0",kind:"stage",actorId:"norma",text:"",emotion:"serious"},
    {id:"quiet",kind:"narration",text:"海风停了。"}
  ]);
  expect(storyMessages([{...lines[0],text:""}])).toHaveLength(1);
});

it("does not put the player's inner voice into an initial physical seat", () => {
  const scene = tideStory("S3-1","final");
  expect(storySlots(scene.lines,scene.offstageActorId)).toEqual({left:"norma",right:"elora"});
  expect(storyActors(scene.lines).some(actor=>actor.id===scene.offstageActorId)).toBe(true);
});

it("preloads silent expressions as well as every final-script speaking expression", () => {
  const silent: AuthoredLine[] = [{id:"silent",text:"",actors:[{characterId:"elora",emotion:"panicked"}]}];
  const spoken: AuthoredLine[] = [{id:"spoken",text:"えっ！？",characterId:"elora",emotion:"panicked"}];
  expect(storyAssets(silent,"/background")).toEqual(storyAssets(spoken,"/background"));
  for (const id of ["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1"]) {
    const scene = tideStory(id,"final");
    for (const url of storyAssets(scene.lines,scene.background)) expect(existsSync(url.slice(1)),url).toBe(true);
  }
});
