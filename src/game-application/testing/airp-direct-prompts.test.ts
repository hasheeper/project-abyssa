import { expect, it } from "vitest";
import { directMaterial, directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { compileDirectInput } from "../airp-direct-gameplay/compile";
import { avgPlanningDirection, avgWritingFlow, avgWritingReminder } from "../../content/presentation/airp/avg-flow";
import { keminiPlanningChecklist } from "../../content/presentation/airp/kemini-profile";
import { acceptGeneratedText } from "../airp-generation/scene";

it("routes AVG flow to real-game planning/writing while preserving the outline, source texts and frozen prose", async () => {
  const f = await directReturnGate("extracted"), material = directMaterial();
  await prepareDirect(f, material);
  const planned = await simulateDirectStage(f, "planning", "第一段、第二段、第三段：仅供输入测试的规划。"), task = planned.airpDirect!.tasks[0];
  const planning = compileDirectInput(material, task.context!, task, "planning");
  const writing = compileDirectInput(material, task.context!, task, "writing");
  const planText = planning.messages.map(m => m.content).join("\n"), writeText = writing.messages.map(m => m.content).join("\n");
  expect(material.preset.planningPrefix.includes(keminiPlanningChecklist)).toBe(true);
  for (const literal of keminiPlanningChecklist.split(/\{\{[^}]*\}\}/).filter(Boolean)) expect(planText.includes(literal)).toBe(true);
  expect(planText).toContain(avgPlanningDirection);
  expect(planText).not.toContain(avgWritingFlow);
  expect(writeText.split(avgWritingFlow)).toHaveLength(2);
  expect(writing.messages.at(-1)?.content).toContain(avgWritingReminder);
  for (const source of material.resources.sources) {
    expect(planText.includes(source.text), source.path).toBe(true); expect(writeText.includes(source.text), source.path).toBe(true);
  }
  // Handwritten mock, not evidence of model quality: consecutive dialogue pages remain intact.
  const lines = [
    {speaker: "narrator", emotion: "neutral", text: "艾洛拉把桌边的位置腾了出来。"},
    {speaker: "elora", emotion: "smile", text: "「おかえりなさい。（欢迎回来。）」"},
    {speaker: "elora", emotion: "neutral", text: "「箱は、こちらへ。（箱子放这边吧。）」"},
    {speaker: "elora", emotion: "serious", text: "「あ、まだ開けなくていいですよ。（啊，先不用打开。）」"},
  ];
  const prose = lines.map(l => l.text).join("\n\n"), written = await simulateDirectStage(f, "writing", prose), frozen = written.airpDirect!.tasks[0];
  const formatting = compileDirectInput(material, frozen.context!, frozen, "formatting");
  expect(JSON.parse(formatting.messages[1].content)).toEqual({draft: prose, feedback: null});
  expect(JSON.stringify(formatting)).not.toContain(avgWritingReminder);
  expect(JSON.stringify(formatting)).not.toContain("EDITORIAL_ONLY");
  expect(acceptGeneratedText(JSON.stringify({creationRecord: "仅原文封装", lines}), prose).lines).toEqual(lines);
}, 120000);
