import { describe, expect, it } from "vitest";
import { hash } from "../airp-generation/contracts";
import { updaterInput, type ReadText } from "./updater";

const input: ReadText = {
  lines: [{id: "box-check", speaker: "elora", text: "交给我后，我会先检查药箱搭扣。"}],
  facts: [], memories: [], flags: {careOffered: false, routeCautionMentioned: false},
};

describe("versioned read-memory instructions", () => {
  it("keeps the first live prompt immutable for old input hashes", () => {
    const legacy = updaterInput(input, 1);
    expect(hash(legacy[0].content)).toBe("2b967b233733b8b6ce292a8816d50b0a9cf70046b1d8c904148c7862738adb11");
    expect(legacy[1].content).toBe(JSON.stringify(input));
  });

  it("distinguishes personal care from checking an object without changing read prose", () => {
    const current = updaterInput(input, 2), legacy = updaterInput(input, 1);
    expect(current[0].content).toContain("对象必须明确是玩家本人");
    expect(current[0].content).toContain("对象不明确时不提出此标记");
    expect(current[0].content).toContain("检查药箱、搭扣、合页");
    expect(current[0].content).toContain("不设置careOffered");
    expect(current[1]).toEqual(legacy[1]);
    expect(updaterInput(input)).toEqual(current);
  });
});
