import { expect, it } from "vitest";
import { directorContinuityHandoff, directorCurrentHandoff } from "./handoff";
import type { DirectorSceneContext } from "./contracts";

it("renders actual time/place/actors and only the current step, without adding prose length/style rules", () => {
  const scene = { phase: 2, locationId: "plaza", actorIds: ["elora"], playerName: "凯尔", role: "offer" as const };
  const text = directorCurrentHandoff(scene, { elora: "艾洛拉" });
  expect(text).toContain("第1日；时段：黄昏；地点：小广场");
  expect(text).toContain("在场者：凯尔、艾洛拉");
  expect(text).toContain("停在玩家参与／推迟／拒绝之前");
  expect(text).not.toMatch(/600|20段|对白占比|思维链/);
  const result = directorCurrentHandoff({ ...scene, phase: 4, role: "result", locationId: "tibby" }, { elora: "艾洛拉" });
  expect(result).toContain("第2日；时段：清晨；地点：缇比的杂货铺");
  expect(result).toContain("承接本事件已确认的实际结果并收尾");
  expect(result).not.toContain("停在玩家参与／推迟／拒绝之前");
});

it("v3 states pending delivery and confirmed delivery separately, without rewriting r8 style", () => {
  const progress: NonNullable<DirectorSceneContext["progress"]> = { status: "feedback", actionIndex: 0, actionCount: 1, actionKind: "patrol", actionOutcome: "succeeded",
    delivery: { runId: "run:1", returnFactId: "fact:return", status: "pending", confirmedFactId: null },
    runResult: { runId: "run:1", outcome: "extracted", deepestLayer: 3 }, readScenes: [], evidenceIds: ["fact:return"] };
  const scene = { phase: 6, locationId: "plaza", actorIds: ["elora"], playerName: "凯尔", role: "feedback" as const, progress };
  const text = directorContinuityHandoff(scene, { elora: "艾洛拉" });
  expect(text).toContain("玩家尚未确认交付"); expect(text).toContain("只承接归来和实际行动反馈");
  expect(text).not.toMatch(/600|20段|对白占比/);
  const result = directorContinuityHandoff({ ...scene, role: "result", progress: { ...progress, status: "ready", delivery: { ...progress.delivery!, status: "confirmed", confirmedFactId: "fact:delivery" } } }, { elora: "艾洛拉" });
  expect(result).toContain("玩家已经明确交付任务目标"); expect(result).not.toContain("玩家尚未确认交付");
  expect(result).toContain("不再次欢迎归来");
  expect(() => directorContinuityHandoff({ ...scene, progress: undefined }, {})).toThrow(/program progress/);
});
