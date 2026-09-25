import { expect, it } from "vitest";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileLowFrame } from "./native";
import { acceptLowText, compileLowRequest } from "./output";

const frame = compileLowFrame(lowR8Source, {id: "phase-test", actors: {elora: "艾洛拉"}, player: {id: "kael", name: "凯尔"}, scenario: "交谈", userInput: "玩家认真倾听",
  dialogue: {turn: 1, role: "offer", purpose: "回应玩家", selectedResponse: "认真倾听", programState: {accepted: false}, taskGuide: []}}, true, 6);
const raw = '<planning>角色演出备忘。</planning><Interleaving><thinking>第一段备忘。</thinking>艾洛拉[smile]：「好了，这样就行。」\n\n<thinking>第二段备忘。</thinking>她收起绷带。\n\n<thinking>第三段备忘。</thinking>艾洛拉[neutral]：「等你决定。」\n\n【可选回应】\n1. 认真倾听\n2. 轻松打趣\n3. 有所保留\n</Interleaving>';
const original = [{speaker: "elora", emotion: "smile", text: "「好了，这样就行。」"}, {speaker: "narrator", emotion: "neutral", text: "她收起绷带。"}, {speaker: "elora", emotion: "neutral", text: "「等你决定。」"}];
it("gives the formatter exact Chinese and phase context, keeping r8 prose untouched", () => {
  const payload = JSON.parse(compileLowRequest(frame, raw).messages[1].content);
  expect(payload.canonicalChinese).toEqual(original);
  expect(payload.rawDraft).toBe(raw); expect(payload.stageContext.selectedResponse).toBe("认真倾听");
});
it("restores original Chinese instead of rejecting or showing a formatter rewrite", () => {
  const result = acceptLowText(JSON.stringify({lines: [{speaker: "elora", emotion: "neutral", text: "被改写的说明文。"}], choices: [], phase: {complete: true, reason: "回应已完成，等待程序决定"}}), raw, frame);
  expect(result.lines).toEqual(original); expect(result.fidelity).toEqual({mode: "canonical", restored: true});
  expect(result.phase?.complete).toBe(true); expect(result.choices).toEqual([]);
});
it("keeps an imperfect usable draft flowing and reports that fidelity is not proven", () => {
  const result = acceptLowText(JSON.stringify({lines: original, choices: ["信任", "打趣", "保留"], phase: {complete: false, reason: "还需回应"}}), "艾洛拉说：好了，这样就行。", frame);
  expect(result.fidelity).toEqual({mode: "model-extracted", restored: false}); expect(result.choices).toHaveLength(3);
});
it("does not confuse an unfinished phase with an exit or accept model commands", () => {
  expect(() => acceptLowText(JSON.stringify({lines: original, choices: [], phase: {complete: false, reason: "还需回答"}}), raw, frame)).toThrow();
  expect(() => acceptLowText(JSON.stringify({lines: original, choices: [], phase: {complete: true, reason: "结束", grant: "item"}}), raw, frame)).toThrow();
});
it("cumulative phase context does not become playable dialogue or rewrite historical instructions", () => {
  const previousRead = [{sceneId: "previous", text: "elora：旧庄园第三层，取空药箱，安全回来找我交付。", knownBy: ["elora", "kael"], evidenceIds: ["read:1"]}];
  const next = compileLowFrame(lowR8Source, {...frame.scene, dialogue: {...frame.scene.dialogue!, previousRead}}, true, 6);
  expect(next.formatInstruction).toContain("前文与本轮合起来");
  expect(frame.formatInstruction).not.toContain("stageContext.previousRead");
  const request = compileLowRequest(next, raw, 6, 2), payload = JSON.parse(request.messages[1].content);
  expect(payload.stageContext.previousRead).toEqual(previousRead);
  expect(payload.canonicalChinese).toEqual(original);
  const result = acceptLowText(JSON.stringify({lines: original, choices: [], phase: {complete: true, reason: "本轮已回应，任务信息前文已齐"}}), raw, next, 6, 2);
  expect(result.lines).toEqual(original); expect(result.phase!.complete).toBe(true);
});
