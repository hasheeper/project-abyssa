import { expect, it } from "vitest";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileLowFrame } from "./native";
import { acceptLowDraft, acceptLowText, compileLowRequest } from "./output";

const scene = { id: "raw-handoff", actors: { elora: "艾洛拉" }, player: { id: "kael", name: "凯尔" }, scenario: "药箱前的交谈", userInput: "玩家尚未表态" };
const frame = compileLowFrame(lowR8Source, scene, true, 5);
const playable = { lines: [{ speaker: "elora", emotion: "neutral", text: "「先别碰。你看，这里卡着东西。」" }], choices: ["仔细确认", "直接帮忙", "暂且观望"] };

it.each([
  "艾洛拉：先别碰。你看，这里卡着东西。",
  "<Interleaving><planning>创作备忘。</planning>艾洛拉[unknown]：「待って。」\n【可选回应】\nA. 先看看",
  "<thinking>创作备忘</thinking>搭扣响了一声。艾洛拉说：‘别动！’<Interleaving>",
])("hands the exact imperfect draft to postprocessing without pre-parsing: %s", raw => {
  expect(() => acceptLowDraft(raw, frame)).not.toThrow();
  expect(acceptLowDraft(raw, frame).warnings.length).toBeGreaterThan(0);
  const request = compileLowRequest(frame, raw), payload = JSON.parse(request.messages[1].content);
  expect(payload.rawDraft).toBe(raw); expect(payload.expressions).toEqual(frame.expressions);
  expect(payload).not.toHaveProperty("expected");
  expect(acceptLowText(JSON.stringify(playable), raw, frame)).toEqual(playable);
});
it("keeps every literary message, full source, preset order and sampling unchanged", () => {
  const previous = compileLowFrame(lowR8Source, scene, true, 4);
  for (const field of ["messages", "sources", "briefs", "trace", "sampling"] as const) expect(frame[field]).toEqual(previous[field]);
});
it("accepts code fences, a display name and missing neutral expression without policing prose length", () => {
  const formatted = { ...playable, lines: [{ speaker: "艾洛拉", text: playable.lines[0].text }] };
  expect(acceptLowText("```json\n" + JSON.stringify(formatted) + "\n```", "原稿", frame)).toEqual(playable);
});
it.each(["not json", '{"error":"原稿只有拒绝，没有叙事"}', JSON.stringify({ ...playable, choices: ["a", "a", "a"] }), JSON.stringify({ ...playable, lines: [{ speaker: "absent", emotion: "neutral", text: "新角色" }] }), JSON.stringify({ ...playable, lines: [{ speaker: "elora", emotion: "neutral", text: "<planning>未剥离</planning>" }] })])("only the final unplayable result fails: %s", raw => {
  expect(() => acceptLowText(raw, "原稿格式不规范", frame)).toThrow();
});
it("does not invent a draft when the body is empty", () => expect(() => acceptLowDraft("  ", frame)).toThrow(/为空/));
