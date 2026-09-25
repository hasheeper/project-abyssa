import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { storyActors, storyAssets, storyMessages, storySlots } from "./story-actors";
import { tideStory } from "../content/presentation/tide-cave";
import type { AuthoredLine, AuthoredUserChoice } from "../content/presentation/authored-story";
import { archiveIdentities } from "../content/characters/identities";
import { CHARACTER_DIALOGUE_ACCENTS } from "../content/presentation/character-dialogue-colors";
import { shopIntroduction } from "../content/presentation/shop-introduction";

it("renders only the committed authored response, never an undecided option", () => {
  const choice: AuthoredUserChoice = {id:"choice.1",kind:"user-choice",prompt:"怎么处理？",text:"怎么处理？",options:[
    {tone:"iron",label:"按住 ·「停。」",action:"{{user}}按住杯子。",line:"停。"},
    {tone:"seasoned",label:"收走 ·「待会儿。」",action:"{{user}}收走杯子。",line:"待会儿。"},
    {tone:"pragmatic",label:"换杯 ·「用这个。」",action:"{{user}}换了杯子。",line:"用这个。"},
  ]};
  expect(storyMessages([choice])).toEqual([]);
  expect(storyMessages([choice],new Map([[0,"pragmatic"]]))).toEqual([{id:"choice.1",kind:"say",actorId:"kael",text:"用这个。",expression:undefined}]);
  expect(storyActors([choice]).find(actor=>actor.id==="kael")).toMatchObject({name:"你",secondaryName:"USER"});
});

it("carries each authored character accent into the real RP adapter", () => {
  const actors = storyActors(archiveIdentities.map(actor => ({id:actor.id,characterId:actor.id,text:"…"})));
  expect(actors).toHaveLength(10);
  expect(actors.every(actor => actor.accent === CHARACTER_DIALOGUE_ACCENTS[actor.id])).toBe(true);
  expect(new Set(actors.map(actor => actor.accent)).size).toBe(10);
  expect(actors.find(actor => actor.id === "marietta")?.accent).toBe("#d98d8d");
});

it("resolves the shop NPC and all authored expression assets without adding a party archive member", () => {
  expect(archiveIdentities.some(actor => actor.id === "tibby")).toBe(false);
  expect(storyActors(shopIntroduction.lines)).toMatchObject([{id: "tibby", name: "缇比", accent: "#d7bb7c"}]);
  const assets = storyAssets(shopIntroduction.lines, shopIntroduction.background);
  expect(assets.some(url => url.includes("tibby/base.png"))).toBe(true);
  for (const url of assets) expect(existsSync(url.slice(1)), url).toBe(true);
});

it("uses the save name in text and player nameplates without changing actors or assets", () => {
  const lines: AuthoredLine[] = [{id: "name", characterId: "kael", text: "{{user}}，出发吧。"}];
  expect(storyActors(lines, "林恩").find(actor => actor.id === "kael")?.name).toBe("林恩");
  expect(storyMessages(lines, new Map(), "林恩")[0]).toMatchObject({actorId: "kael", text: "林恩，出发吧。"});
  expect(storyActors(lines).find(actor => actor.id === "kael")?.name).toBe("你");
  expect(storyMessages(lines)[0]).toMatchObject({text: "你，出发吧。"});
});

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

it("does not preload POV portrait assets, but retains the player identity for dialogue", () => {
  const lines: AuthoredLine[] = [{ id: "pov", characterId: "kael", text: "我在这里。" }, { id: "npc", characterId: "elora", text: "看到了。" }];
  expect(storyActors(lines).some(actor => actor.id === "kael")).toBe(true);
  expect(storySlots(lines, "kael")).toEqual({ left: "elora", right: undefined });
  expect(storyAssets(lines, "/background", "kael")).toEqual(storyAssets(lines.slice(1), "/background"));
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
