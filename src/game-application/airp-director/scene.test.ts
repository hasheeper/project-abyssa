import { expect, it } from "vitest";
import { acceptDirectorText, readDirectorWriting } from "./scene";

const prose = "旁白：杯子还温着。\n\n柯萝萝：「どうぞ。（请坐。）」";
const formatted = {creationRecord: "按原文逐段封装", lines: [
  {speaker: "narrator", emotion: "neutral", text: "杯子还温着。"},
  {speaker: "kororo", emotion: "smile", text: "「どうぞ。（请坐。）」"},
]};

it("keeps each labeled bilingual paragraph and speaker verbatim", () => {
  expect(acceptDirectorText(JSON.stringify(formatted), prose, ["kororo"])).toEqual(formatted);
});
it("tolerates only a wrapped closing quotation without rewriting text or accepting missing bilingual content", () => {
  const raw = "<planning>演出记录。</planning><prose>艾洛拉：「どうぞ。（请坐。）\n」\n</prose>";
  expect(readDirectorWriting(raw, 4).prose).toBe("艾洛拉：「どうぞ。（请坐。）」");
  expect(raw).toContain("\n」");
  expect(() => readDirectorWriting(raw.replace("（请坐。）", ""), 4)).toThrow();
  expect(() => readDirectorWriting(raw.replace("\n」", ""), 4)).toThrow();
});
it("rejects the real-provider creationRecord object instead of silently coercing it", () => {
  expect(() => acceptDirectorText(JSON.stringify({...formatted, creationRecord: {}}), prose, ["kororo"])).toThrow();
});
it("rejects creative rewrites, unapproved speakers and merged paragraphs", () => {
  for (const lines of [
    [formatted.lines[0], {...formatted.lines[1], text: "「お帰り。（欢迎回来。）」"}],
    [formatted.lines[0], {...formatted.lines[1], speaker: "elora"}],
    [{...formatted.lines[0], text: formatted.lines.map(l => l.text).join("\n")}],
  ]) expect(() => acceptDirectorText(JSON.stringify({...formatted, lines}), prose, ["kororo"])).toThrow();
});
