import { expect, it } from "vitest";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileLowFrame } from "./native";
import { acceptLowText, compileLowRequest } from "./output";
import { LOW_FIELD_REPAIR_INSTRUCTION } from "./prompt";

const scene = {id: "emotion-test", actors: {elora: "艾洛拉", kororo: "柯萝萝"}, player: {id: "kael", name: "凯尔"}, scenario: "门前交谈", userInput: "认真倾听",
  dialogue: {turn: 1, role: "offer", purpose: "回应玩家", selectedResponse: "认真倾听", programState: {}, taskGuide: []}};
const draft = "门轴响了一声。艾洛拉说：等一下。她又说：我才没有窘迫！";
const choices = ["认真倾听", "轻松打趣", "有所保留"];
function output(emotion: unknown, speaker = "elora", interactive = true) {
  return JSON.stringify({lines: [{speaker: "narrator", emotion: "neutral", text: "门轴响了一声。"}, {speaker: "elora", emotion: "neutral", text: "「等一下。」"}, {speaker, emotion, text: "「我才没有窘迫！」"}], choices,
    ...(interactive ? {phase: {complete: false, reason: "等待玩家回应"}} : {})});
}

it.each([5, 6] as const)("reader %i reproduces the old error and maps 窘迫 without changing text", reader => {
  const frame = compileLowFrame(lowR8Source, scene, true, reader), raw = output("窘迫", "elora", reader === 6);
  expect(() => acceptLowText(raw, draft, frame, reader, 1)).toThrow("第3段表情不在角色目录：窘迫");
  const value = acceptLowText(raw, draft, frame, reader, 2);
  expect(value.lines[2]).toEqual({speaker: "elora", emotion: "flustered", text: "「我才没有窘迫！」"});
  expect(value.choices).toEqual(choices);
  expect(value.formatWarnings).toEqual(["第3段表情标记已规范为 flustered；正文未改动。"]);
  if (reader === 6) expect(value.phase).toEqual({complete: false, reason: "等待玩家回应"});
});

it.each(Object.entries(lowR8Source.common))("maps authored label %s=%s using the frozen catalog", (id, label) => {
  const frame = compileLowFrame(lowR8Source, scene, true, 6);
  for (const raw of [id, label, ` ${label} `, id.toUpperCase()]) {
    expect(acceptLowText(output(raw), draft, frame, 6, 2).lines[2].emotion).toBe(id);
  }
});

it.each([undefined, null, "", " ", "未收录表情", "flustered/窘迫", "wink", 123, {id: "flustered"}])("unusable emotion %j falls back to neutral without rejecting prose", emotion => {
  const frame = compileLowFrame(lowR8Source, scene, true, 6);
  const result = acceptLowText(output(emotion), draft, frame, 6, 2);
  expect(result.lines[2]).toEqual({speaker: "elora", emotion: "neutral", text: "「我才没有窘迫！」"});
});

it("preserves only the current actor's authored special, including non-English IDs", () => {
  const frame = compileLowFrame(lowR8Source, scene, true, 6);
  expect(acceptLowText(output(">_<"), draft, frame, 6, 2).lines[2].emotion).toBe(">_<");
  expect(acceptLowText(output("wink", "kororo"), draft, frame, 6, 2).lines[2].emotion).toBe("wink");
  expect(acceptLowText(output(">_<", "kororo"), draft, frame, 6, 2).lines[2].emotion).toBe("neutral");
  expect(acceptLowText(output("wink", "kael"), draft, frame, 6, 2).lines[2].emotion).toBe("neutral");
  expect(acceptLowText(output("窘迫", "旁白"), draft, frame, 6, 2).lines[2]).toMatchObject({speaker: "narrator", emotion: "neutral"});
});

it("supplies explicit legal IDs and field repair instructions without changing the draft or frozen input", () => {
  const frame = compileLowFrame(lowR8Source, scene, true, 6), frozen = structuredClone(frame);
  const prior = compileLowRequest(frame, draft, 6, 1), current = compileLowRequest(frame, draft, 6, 2);
  const payload = JSON.parse(current.messages[1].content);
  expect(payload.expressions.common.flustered).toBe("窘迫");
  expect(payload.fieldCatalog).toEqual({narrator: {speaker: "narrator", emotion: "neutral"}, commonEmotionIds: Object.keys(frame.expressions.common),
    actors: [{speaker: "elora", specialEmotionIds: [">_<"]}, {speaker: "kororo", specialEmotionIds: ["wink"]}], player: {speaker: "kael", specialEmotionIds: []}});
  expect(payload.rawDraft).toBe(draft);
  expect(current.messages[0].content).toContain(LOW_FIELD_REPAIR_INSTRUCTION);
  expect(current.messages[0].content).toContain("common的中文值仅解释含义，不是输出值");
  expect(compileLowRequest(frame, undefined, 6, 2)).toEqual(compileLowRequest(frame));
  expect(compileLowRequest(frame, draft, 6, 1)).toEqual(prior); expect(frame).toEqual(frozen);
});

it("still rejects absent actors or creative records rather than disguising them as emotion repairs", () => {
  const frame = compileLowFrame(lowR8Source, scene, true, 6);
  expect(() => acceptLowText(output("窘迫", "absent"), draft, frame, 6, 2)).toThrow(/说话者不在本场角色目录/);
  expect(() => acceptLowText(output("窘迫").replace("我才没有窘迫！", "<planning>备忘</planning>"), draft, frame, 6, 2)).toThrow(/创作标签/);
});
