import { expect, it } from "vitest";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileLowFrame } from "./native";
import { acceptLowText, compileLowRequest } from "./output";
import { LOW_SPEAKER_FORMAT_INSTRUCTION } from "./prompt";

const scene = {id: "speaker-test", actors: {elora: "艾洛拉"}, player: {id: "kael", name: "凯尔"}, scenario: "门前交谈", userInput: "认真倾听",
  dialogue: {turn: 1, role: "offer", purpose: "回应玩家", selectedResponse: "认真倾听", programState: {}, taskGuide: []}};
const draft = "门轴响了一声。艾洛拉说：门就在前面，要走了吗？";
const lines = [{speaker: "narrator", emotion: "neutral", text: "门轴响了一声。"}, {speaker: "elora", emotion: "neutral", text: "「门就在前面，要走了吗？」"}];
const choices = ["认真倾听", "轻松打趣", "有所保留"];

it.each([5, 6] as const)("format v1 on reader %i requires narrator without changing frozen prose or requests", version => {
  const frame = compileLowFrame(lowR8Source, scene, true, version), frozen = structuredClone(frame);
  const old = compileLowRequest(frame, draft), current = compileLowRequest(frame, draft, version, 1);
  expect(current.messages[0].content).toBe(`${old.messages[0].content}\n${LOW_SPEAKER_FORMAT_INSTRUCTION}`);
  expect(current.messages[0].content).toContain('"speaker":"narrator"');
  expect(current.messages[1]).toEqual(old.messages[1]);
  expect(current.requestHash).not.toBe(old.requestHash);
  expect(compileLowRequest(frame, undefined, version, 1)).toEqual(compileLowRequest(frame));
  expect(frame).toEqual(frozen); expect(compileLowRequest(frame, draft)).toEqual(old);
});

it.each([5, 6] as const)("reader %i normalizes only narrator aliases, preserving Chinese and phase/choices", version => {
  const frame = compileLowFrame(lowR8Source, scene, true, version);
  for (const speaker of ["narrator", "旁白", " 旁白 ", "Narrator"]) {
    const raw = JSON.stringify({lines: [{...lines[0], speaker}, {...lines[1], speaker: "艾洛拉"}], choices, ...(version === 6 ? {phase: {complete: false, reason: "等待回应"}} : {})});
    const result = acceptLowText(raw, draft, frame, version, 1);
    expect(result.lines).toEqual(lines); expect(result.choices).toEqual(choices);
    if (version === 6) expect(result.phase).toEqual({complete: false, reason: "等待回应"});
    if (speaker !== "narrator") expect(() => acceptLowText(raw, draft, frame)).toThrow(/说话者不在本场角色目录/);
  }
});

it.each(["不在场角色", "旁白角色", "narrator-extra"])("does not disguise unknown speaker %s as narration", speaker => {
  const frame = compileLowFrame(lowR8Source, scene, true, 5);
  expect(() => acceptLowText(JSON.stringify({lines: [{...lines[0], speaker}], choices}), draft, frame, 5, 1)).toThrow(/说话者不在本场角色目录/);
});

it("keeps missing narration emotion neutral and never bypasses text or choice checks", () => {
  const frame = compileLowFrame(lowR8Source, scene, true, 5);
  const value = {lines: [{speaker: "旁白", text: lines[0].text}, lines[1]], choices};
  expect(acceptLowText(JSON.stringify(value), draft, frame, 5, 1).lines).toEqual(lines);
  expect(() => acceptLowText(JSON.stringify({...value, lines: [{speaker: "旁白", text: "<planning>备忘</planning>"}]}), draft, frame, 5, 1)).toThrow(/创作标签/);
  expect(() => acceptLowText(JSON.stringify({...value, choices: []}), draft, frame, 5, 1)).toThrow(/三个不同/);
});
