import { describe, expect, it } from "vitest";
import { AIRP_TEXT_EMOTIONS } from "../airp/contracts";
import { performedParagraphs, validateCreativeStage } from "./creative-output";
import { acceptGeneratedText } from "./scene";
import { acceptDirectorText, compileDirectorScene } from "../airp-director/scene";
import { compileInput } from "./context";
import { defaultSpecification } from "../../game-runtime/airp-generation";
import { creationEnvelope } from "../testing/airp-writing-fixture";
import { directorTestJob, directorTestMaterial } from "../testing/airp-director-fixture";
import { hash } from "./contracts";
import { v5GenerationResources, v5BuiltinGenerationPreset, v6GenerationResources, v6BuiltinGenerationPreset } from "../../content/presentation/airp/generation-resources";
import { parsePreset } from "./preset";

const bodies: [string, string, string] = ["旁白：她翻开纸页。", "艾洛拉：「これ？（这个（圈出的地方）？）」", "艾洛拉：「ありがとう。（谢谢。）」"];
const creation = creationEnvelope(bodies), draft = `${bodies[0]}\n${bodies[1].replace("艾洛拉：", "艾洛拉[confused]：")}\n${bodies[2].replace("艾洛拉：", "艾洛拉[smile]：")}`;
const actors = {elora: "艾洛拉", kororo: "柯萝萝"};
const scene = (prose = draft) => ({creationRecord: "保留中文和文笔表情", lines: performedParagraphs(prose, actors).map(p => ({speaker: p.speaker, emotion: p.emotion, text: p.chinese}))});

describe("v6 literary expressions", () => {
  it.each(AIRP_TEXT_EMOTIONS)("accepts existing %s without exposing its annotation", emotion => {
    const prose = `艾洛拉[${emotion}]：「はい。（好。）」`;
    expect(performedParagraphs(prose)[0]).toMatchObject({speaker: "elora", emotion, chinese: "「好。」", text: "「はい。（好。）」"});
    expect(acceptGeneratedText(JSON.stringify(scene(prose)), prose, 6).lines[0]).toEqual({speaker: "elora", emotion, text: "「好。」"});
  });
  it.each([
    "艾洛拉：「はい。（好。）」", "艾洛拉[happy]：「はい。（好。）」", "艾洛拉[微笑]：「はい。（好。）」",
    "艾洛拉[smile][joy]：「はい。（好。）」", "旁白[neutral]：桌子。", "诺玛[smile]：「はい。（好。）」",
    "艾洛拉[smile]：「はい。（はい。）」", "艾洛拉[smile]：你好。", "",
  ])("rejects missing/invalid/unavailable expressions without guessing: %s", prose => expect(() => performedParagraphs(prose)).toThrow());
  it("keeps creator unannotated, editor annotated, and rejects metadata in old v5 prose", () => {
    expect(validateCreativeStage("planning", creation, "", undefined, 6)).toBe(bodies.join("\n\n"));
    expect(validateCreativeStage("writing", `<prose>${draft}</prose>`, creation, undefined, 6)).toBe(draft);
    expect(() => validateCreativeStage("writing", `<prose>${bodies.join("\n")}</prose>`, creation, undefined, 6)).toThrow(/表情/);
    expect(() => validateCreativeStage("writing", `<prose>${draft}</prose>`, creation, undefined, 5)).toThrow();
    expect(validateCreativeStage("writing", `<prose>${bodies.join("\n")}</prose>`, creation, undefined, 5)).toBe(bodies.join("\n"));
    expect(() => validateCreativeStage("writing", `<prose>${draft}\n旁白：新增一段。</prose>`, creation, undefined, 6)).toThrow(/增加/);
  });
  it("preserves expressions exactly through both text acceptors, including multiple NPCs", () => {
    const multi = `${draft}\n柯萝萝[wry]：「まったく。（真是的。）」`;
    expect(acceptDirectorText(JSON.stringify(scene(multi)), multi, ["elora", "kororo"], 6)).toEqual(scene(multi));
    expect(acceptGeneratedText(JSON.stringify(scene()), draft, 6)).toEqual(scene());
    for (const mutate of [
      (s: ReturnType<typeof scene>) => {s.lines[1].emotion = "neutral";},
      (s: ReturnType<typeof scene>) => {s.lines[1].speaker = "艾洛拉";},
      (s: ReturnType<typeof scene>) => {s.lines[1].text = "「[confused]这个？」";},
      (s: ReturnType<typeof scene>) => {s.lines[1].text = "「那一个？」";},
      (s: ReturnType<typeof scene>) => {s.lines.reverse();},
      (s: ReturnType<typeof scene>) => {s.lines.pop();},
    ]) {
      const bad = scene(); mutate(bad);
      expect(() => acceptGeneratedText(JSON.stringify(bad), draft, 6)).toThrow();
      expect(() => acceptDirectorText(JSON.stringify(bad), draft, ["elora"], 6)).toThrow();
    }
  });
  it("provides parsed speaker/expression map to formatter without loading original character documents", () => {
    const preset = parsePreset(JSON.stringify(v6BuiltinGenerationPreset));
    const spec = {...defaultSpecification(), resources: structuredClone(v6GenerationResources), preset, orderId: preset.orders[0].id}; expect(spec.resources.version).toBe(6);
    const input = compileInput("formatting", spec, creation, draft);
    expect(JSON.parse(input.messages.at(-1)!.content)).toEqual({draft, feedback: null, paragraphMap: [
      {index: 0, speaker: "narrator", emotion: "neutral"}, {index: 1, speaker: "elora", emotion: "confused"}, {index: 2, speaker: "elora", emotion: "smile"},
    ]});
    for (const source of spec.resources.sources) expect(JSON.stringify(input.messages)).not.toContain(source.text);
    const writer = compileInput("writing", spec, creation);
    expect(JSON.stringify(writer.messages)).toContain("文笔"); expect(JSON.stringify(writer.messages)).toContain("[emotion]");
    for (const source of spec.resources.sources) expect(JSON.stringify(writer.messages).includes(JSON.stringify(source.text).slice(1, -1))).toBe(source.kind !== "world");
    const oldPreset = parsePreset(JSON.stringify(v5BuiltinGenerationPreset));
    const old = {...spec, resources: structuredClone(v5GenerationResources), preset: oldPreset, orderId: oldPreset.orders[0].id};
    // No creative prompt edits or new expression instructions reach Sol.
    expect(compileInput("planning", spec).messages).toEqual(compileInput("planning", old).messages);
    expect(JSON.parse(compileInput("formatting", old, creation, bodies.join("\n")).messages.at(-1)!.content)).not.toHaveProperty("paragraphMap");
  });
  it("GM compiler uses the same v6 metadata path", () => {
    const material = directorTestMaterial(6), job = directorTestJob(material); job.kind = "scene"; job.planning = null;
    job.scene = {version: 1, sourceKind: "gameplay", head: {saveId: "s", epoch: "e", revision: 0}, phase: 2, playerName: "林恩", eventId: "event", sceneId: "scene", role: "offer", actorIds: ["elora"], locationId: "hall",
      card: directorTestJob().planning!.fixed[0].card, actionIndex: 0, occurrence: 0, intent: "本次请求", choices: [], selected: [], facts: [], memories: [], previous: [], taskReports: [], authorSource: null};
    job.attempts = [creation, `<prose>${draft}</prose>`].map((output, i) => ({id: `a${i}`, stage: i ? "writing" : "planning", ordinal: 1, inputHash: hash(output), at: 1, endedAt: 2, status: "succeeded", output, usage: {inputTokens: null, outputTokens: null, totalTokens: null}, outcomeUnknown: false, error: null}));
    expect(JSON.parse(compileDirectorScene(material, job, "formatting").messages.at(-1)!.content).paragraphMap[1]).toEqual({index: 1, speaker: "elora", emotion: "confused"});
  });
});
