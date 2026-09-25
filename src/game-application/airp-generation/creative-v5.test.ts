import { describe, expect, it } from "vitest";
import { defaultSpecification as currentSpecification } from "../../game-runtime/airp-generation";
import { v5BuiltinGenerationPreset, v5GenerationResources } from "../../content/presentation/airp/generation-resources";
import { compileInput } from "./context";
import { parsePreset } from "./preset";
import { keminiCreationModules, keminiOriginalModules } from "../../content/presentation/airp/kemini-profile";
import { bilingualParagraphs, chineseDialogue, readCreationOutput, readEditedOutput, validateCreativeStage } from "./creative-output";
import { acceptGeneratedText } from "./scene";
import { acceptDirectorText, compileDirectorScene } from "../airp-director/scene";
import { directorTestMaterial, directorTestJob } from "../testing/airp-director-fixture";
import { creationEnvelope } from "../testing/airp-writing-fixture";
import { hash } from "./contracts";
const defaultSpecification = () => {const preset = parsePreset(JSON.stringify(v5BuiltinGenerationPreset)); return {...currentSpecification(), resources: structuredClone(v5GenerationResources), preset, orderId: preset.orders[0].id};};

const bodies: [string, string, string] = ["旁白：艾洛拉把空位让出来。", "艾洛拉：「ここに。（放这儿（桌边），好吗？）」", "艾洛拉：「ありがとう。（谢谢。）」"];
const creation = creationEnvelope(bodies), prose = bodies.join("\n\n"), edited = `<prose>${prose}</prose>`;
const scene = {creationRecord: "中文提取", lines: bilingualParagraphs(prose).map(p => ({speaker: p.speaker, emotion: "neutral", text: p.chinese}))};

describe("current v5 creation/editor/Chinese wire contract", () => {
  it("extracts three bodies without leaking creative records; editor uses only prose", () => {
    expect(readCreationOutput(creation).prose).toBe(prose);
    expect(readEditedOutput(edited)).toEqual({editorial: null, prose});
    expect(validateCreativeStage("planning", creation, "")).toBe(prose);
    expect(validateCreativeStage("writing", edited, creation)).toBe(prose);
    expect(() => validateCreativeStage("writing", `<prose>${prose}\n旁白：多加一段。</prose>`, creation)).toThrow(/增加/);
  });
  it.each([
    "只有大纲", creation.replace("</Interleaving>", ""), `说明${creation}`, creation.replace("CREATION_RECORD_ONLY_1", ""),
    creation.replace(bodies[1], ""), creation.replace("</Interleaving>", "<thinking>第四组</thinking>旁白：增加。</Interleaving>"),
    creation.replace(bodies[1], "<prose>旁白：错误嵌套</prose>"), creation.replace(bodies[1], "<planning>错误记录</planning>"),
  ])("rejects malformed creation without a best-effort substring fallback", raw => expect(() => readCreationOutput(raw)).toThrow());
  it.each([`<planning>旧版记录</planning>${edited}`, `<prose></prose>`, `${edited}额外文字`, edited.replace("</prose>", ""), `<prose>${edited}</prose>`])("rejects invalid editor envelopes", raw => expect(() => readEditedOutput(raw)).toThrow());
  it("projects Chinese exactly, including nested parentheses, punctuation and quoted words", () => {
    expect(chineseDialogue("「そう。（她说「好」（不是拒绝）。）」")).toBe("「她说「好」（不是拒绝）。」");
    expect(chineseDialogue("「ええ（小声）。（好。（轻声））」")).toBe("「好。（轻声）」");
    expect(acceptGeneratedText(JSON.stringify(scene), prose, 5)).toEqual(scene);
    for (const text of ["「そう。」", "「（好。）」", "「そう。（）」", "「そう。（いい。）」", "「そう。（好（。）」"]) expect(() => chineseDialogue(text)).toThrow();
  });
  it("rejects Japanese leakage, rewrites, reordered/merged lines and speaker swaps", () => {
    for (const lines of [scene.lines.slice(1), [...scene.lines].reverse(), scene.lines.map((l, i) => i === 1 ? {...l, text: "「ここに。（放这儿（桌边），好吗？）」"} : l),
      scene.lines.map((l, i) => i === 1 ? {...l, text: "「放到那里。」"} : l), scene.lines.map((l, i) => i === 1 ? {...l, speaker: "narrator"} : l)])
      expect(() => acceptGeneratedText(JSON.stringify({...scene, lines}), prose, 5)).toThrow();
    for (const text of ["未知：台词", "艾洛拉：没有日文。", "旁白：こんにちは。", "没有标签的旁白。"])
      expect(() => bilingualParagraphs(text)).toThrow();
  });
  it("supports multiple authorized NPCs without assigning everyone to Elora", () => {
    const draft = `${prose}\n柯萝萝：「どうぞ。（请坐。）」`, lines = [...scene.lines, {speaker: "kororo", emotion: "smile", text: "「请坐。」"}];
    expect(acceptDirectorText(JSON.stringify({...scene, lines}), draft, ["elora", "kororo"], 5).lines).toEqual(lines);
    expect(() => acceptDirectorText(JSON.stringify({...scene, lines}), draft, ["elora"], 5)).toThrow();
  });
});

describe("current default v5 prompt assembly", () => {
  it("restores full ICOT and kept module roles/order without altering author sources", () => {
    const spec = defaultSpecification(), input = compileInput("planning", spec);
    expect(spec.resources.version).toBe(5);
    for (const source of spec.resources.sources) expect(input.messages.some(m => m.content.includes(source.text))).toBe(true);
    const ids = keminiCreationModules.map(m => m.identifier);
    expect(ids).toEqual(keminiOriginalModules.filter(m => ids.includes(m.identifier)).map(m => m.identifier));
    const icot = keminiOriginalModules.find(m => m.identifier === "fd9adcfd-bbbe-447e-8be6-4f1d87e50da7")!.content;
    const message = input.messages.find(m => m.content.includes("<Interleaved_thinking>"))!;
    for (const literal of icot.split(/\{\{[^}]*\}\}/).filter(Boolean)) expect(message.content).toContain(literal);
    for (const id of ["a443f257-0f5d-4286-a1ff-f60653ed6400", "d07b0943-0502-41b7-b126-a15998d4eca0"]) {
      const raw = keminiOriginalModules.find(m => m.identifier === id)!.content;
      expect(input.messages.find(m => m.content.includes(raw.split("{{")[0]))?.role).toBe("user");
    }
    const text = input.messages.map(m => m.content).join("\n");
    expect(text).not.toContain("出段状态与下一段接口"); expect(text).not.toContain("拟态废案"); expect(text).not.toContain("不少于1000字");
    expect(text).toContain("为什么找他"); expect(text).toContain("choices相容"); expect(text).toContain("不作为本场填充要求");
  });
  it("passes only draft plus full current cards/style/context to editor, only bilingual draft to formatter", () => {
    const s = defaultSpecification(), input = compileInput("writing", s, creation), text = input.messages.map(m => m.content).join("\n");
    expect(text).toContain(prose); expect(text).not.toContain("CREATION_RECORD_ONLY"); expect(text).not.toContain("<Interleaved_thinking>");
    for (const source of s.resources.sources) expect(text.includes(source.text)).toBe(source.kind !== "world");
    expect(text).toContain("冬马和纱"); // Full original style reference, not removed for cost.
    const formatting = compileInput("formatting", s, creation, prose);
    expect(JSON.parse(formatting.messages.at(-1)!.content)).toEqual({draft: prose, feedback: null});
    for (const source of s.resources.sources) expect(JSON.stringify(formatting.messages)).not.toContain(source.text);
  });
  it("does not silently replace a custom preset; order and unsupported-feature validation still apply", () => {
    const s = defaultSpecification(); s.preset = parsePreset(JSON.stringify({prompts: [{identifier: "custom", role: "user", content: "CUSTOM_{{user}}"}], prompt_order: [{character_id: "custom", order: [{identifier: "custom", enabled: true}]}]})); s.orderId = "custom";
    expect(compileInput("planning", s).messages).toContainEqual({role: "user", content: "CUSTOM_你"});
    s.preset.modules[0].unsupported.push("深度插入"); expect(() => compileInput("planning", s)).toThrow();
  });
  it("GM editor receives full read history, actual choices/name/facts, not future card scaffolding", () => {
    const material = directorTestMaterial(5), job = directorTestJob(material); job.kind = "scene"; job.planning = null;
    job.scene = {version: 1, sourceKind: "gameplay", head: {saveId: "s", epoch: "e", revision: 0}, phase: 2, playerName: "林恩", eventId: "event", sceneId: "scene", role: "offer", actorIds: ["elora", "kororo"], locationId: "hall",
      card: {...directorTestJob().planning!.fixed[0].card, title: "FUTURE_CARD_ONLY"}, actionIndex: 0, occurrence: 0, intent: "本次请求", choices: [], selected: [], facts: [], memories: [],
      previous: [{sceneId: "previous", text: "READ_PREVIOUS_FULL", knownBy: ["elora", "kororo"], evidenceIds: ["read"]}], taskReports: [], authorSource: {text: "FUTURE_AUTHOR_SOURCE_ONLY", digest: hash("source")}};
    job.attempts = [{id: "plan", stage: "planning", ordinal: 1, inputHash: "", at: 1, endedAt: 2, status: "succeeded", output: creation, usage: {inputTokens: null, outputTokens: null, totalTokens: null}, outcomeUnknown: false, error: null}];
    const text = compileDirectorScene(material, job, "writing").messages.map(m => m.content).join("\n");
    expect(text).toContain("READ_PREVIOUS_FULL"); expect(text).toContain("林恩"); expect(text).not.toContain("FUTURE_CARD_ONLY"); expect(text).not.toContain("FUTURE_AUTHOR_SOURCE_ONLY"); expect(text).not.toContain("CREATION_RECORD_ONLY");
    for (const id of ["elora", "kororo"]) expect(text).toContain(material.resources.sources.find(s => s.id === id)!.text);
    for (const id of ["eustice", "norma"]) expect(text).not.toContain(material.resources.sources.find(s => s.id === id)!.text);
  });
});
