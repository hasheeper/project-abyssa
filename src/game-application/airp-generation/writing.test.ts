import { describe, expect, it } from "vitest";
import { readProseOnlyWritingOutput, readWritingOutput } from "./writing";
import { acceptGeneratedText } from "./scene";
import { editorialFixture, writingEnvelope } from "../testing/airp-writing-fixture";

const prose = "艾洛拉看向桌边。\n\n「おかえりなさい。（欢迎回来。）」";
describe("versioned writing output boundary", () => {
  it("keeps the complete bilingual prose and leaves editorial material out of JSON", () => {
    const result = readWritingOutput(writingEnvelope(prose), 4);
    expect(result).toEqual({editorial: editorialFixture, prose});
    const formatted = JSON.stringify({creationRecord: "保留原文。", lines: [
      {speaker: "narrator", emotion: "neutral", text: "艾洛拉看向桌边。"},
      {speaker: "elora", emotion: "smile", text: "「おかえりなさい。（欢迎回来。）」"},
    ]});
    expect(acceptGeneratedText(formatted, result.prose).lines).toHaveLength(2);
  });
  it.each([2, 3])("does not reinterpret older version %s, even if it contains tags", version => {
    const text = writingEnvelope(prose);
    expect(readWritingOutput(text, version)).toEqual({editorial: null, prose: text});
  });
  it.each([
    prose, `<planning>记录</planning>`, `<prose>${prose}</prose>`,
    writingEnvelope(prose, " "), writingEnvelope(" "),
    writingEnvelope(prose) + writingEnvelope(prose),
    writingEnvelope("<prose>重复嵌套</prose>"), writingEnvelope(prose, "<planning>嵌套</planning>"),
    writingEnvelope(prose).replace("</prose>", ""),
    "```xml\n" + writingEnvelope(prose) + "\n```", "前缀" + writingEnvelope(prose),
    writingEnvelope("「おかえりなさい。」"), writingEnvelope("「おかえりなさい。」（欢迎回来。）"),
    writingEnvelope("「おかえりなさい。（ ）」"), writingEnvelope("艾洛拉：只有中文"),
  ])("rejects ambiguous/missing sections without guessing the story: %s", output => {
    expect(() => readWritingOutput(output, 4)).toThrow();
  });
});

describe("explicit prose-only A/B contract", () => {
  it("accepts prose without inventing an editorial record and keeps v4 strict", () => {
    const output = `<prose>${prose}</prose>`;
    expect(readProseOnlyWritingOutput(output)).toEqual({ editorial: null, prose });
    expect(() => readWritingOutput(output, 4)).toThrow();
  });
  it.each([
    prose, "<prose> </prose>", `<prose>${prose}`, `${prose}</prose>`,
    writingEnvelope(prose), `<prose><planning>记录</planning>${prose}</prose>`,
    `<prose><prose>${prose}</prose></prose>`, `<prose>${prose}</prose><prose>重复</prose>`,
    `前缀<prose>${prose}</prose>`, `\`\`\`xml\n<prose>${prose}</prose>\n\`\`\``,
    "<prose>「おかえりなさい。」</prose>", "<prose>「おかえりなさい。」（欢迎回来。）</prose>",
    "<prose>艾洛拉：只有中文</prose>",
  ])("does not repair or guess prose-only output: %s", output => {
    expect(() => readProseOnlyWritingOutput(output)).toThrow();
  });
});
