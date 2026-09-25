import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { formalAirpFixture } from "../../game-application/testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../../game-application/testing/airp-director-playthrough";
import { directorTestMaterial } from "../../game-application/testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { GameSession } from "../session";
import { GameSessionScope } from "../react";
import { useDirector } from "./useDirector";

const mock = vi.hoisted(() => ({snapshot: {}, connection: {} as any, outputs: [] as string[], gmOutputs: [] as string[], calls: [] as string[], coverAcceptance: false}));
vi.mock("../../game-runtime/airp-configuration", () => ({aiConfiguration: {subscribe: () => () => {}, getSnapshot: () => mock.snapshot}, effectiveAiConfiguration: () => mock.connection}));
vi.mock("../../game-runtime/airp-director-driver", async original => {
  const actual = await original<typeof import("../../game-runtime/airp-director-driver")>();
  return {...actual, createDirectorDriver: () => actual.createDirectorDriver({lock: async (_key, _signal, operation) => operation(), provider: async request => {
    mock.calls.push(JSON.parse(request.messages[1].content).currentText ? "scene-evaluate" : "scene-plan");
    let text = mock.gmOutputs.shift(); if (!text) throw Error("Unexpected GM call");
    const context = JSON.parse(request.messages[1].content);
    if (mock.coverAcceptance && context.acceptanceCoverage?.candidates.length) text = JSON.stringify({...JSON.parse(text), coveredAcceptance: [{choiceId: "participate", basisSceneIds: [context.acceptanceCoverage.currentSceneId], reason: "这次实际态度已经回应，无需再写接单对白"}]});
    return {text, usage: {inputTokens: 10, outputTokens: 10, totalTokens: 20}, finishReason: "stop"};
  }, lowProvider: async request => {
    mock.calls.push(request.stage); const text = mock.outputs.shift(); if (!text) throw Error("Unexpected call");
    return {text, usage: {inputTokens: 10, outputTokens: 10, totalTokens: 20}, finishReason: "stop"};
  }})};
});
afterEach(cleanup);
it("prepares the formal28 six-person day through the real hook without making a provider call", async () => {
  const f = await formalAirpFixture(undefined, 28), material = directorTestMaterial(8);
  mock.connection = {material, models: material.models, keys: {planning: "test-key", writing: "test-key", updater: "test-key"}};
  mock.calls = [];
  const session = new GameSession(f.runtime, {saveId: "formal-airp", epoch: "epoch:1"}, {getItem: () => null, setItem() {}, removeItem() {}}, () => {});
  await session.refresh();
  const wrapper = ({children}: {children: ReactNode}) => <GameSessionScope session={session}>{children}</GameSessionScope>;
  const hook = renderHook(useDirector, {wrapper});
  await act(async () => {await hook.result.current.prepareDay();});
  const state = f.raw().airpDirector!, day = state.jobs.at(-1)!;
  expect(state.residentCast?.version).toBe(1);
  expect(day.planning!.capabilities.actorIds).toEqual(expect.arrayContaining(["marietta", "abyssa"]));
  expect(day.gmContext!.documents).toEqual(expect.arrayContaining([expect.objectContaining({id: "household-guidance"})]));
  expect(f.raw().airpGame!.settlement.policy.actorIds).toEqual(expect.arrayContaining(["marietta", "abyssa"]));
  expect(f.raw().snapshot.campaign.availableCharacterIds).not.toContain("abyssa");
  expect(mock.calls).toEqual([]);
  session.dispose();
}, 30000);
it.each([false, true])("the real hook generates the reply and respects GM-covered acceptance=%s without extra calls", async covered => {
  const f = await formalAirpFixture(), material = directorTestMaterial(); await f.flow.sync();
  mock.connection = {material, models: material.models, keys: {planning: "test-key", writing: "test-key", updater: "test-key"}}; mock.calls = [];
  mock.coverAcceptance = covered;
  const formatted = (complete: boolean) => JSON.stringify({lines: [{speaker: "elora", emotion: "smile", text: "我听见你的回应了。"}], choices: complete ? [] : ["认真听", "轻松说", "有所保留"], phase: {complete, reason: complete ? "已经回答" : "尚待回应"}});
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowContextVersion: 12, lowReadVersion: 6});
  const wf = {read: async () => f.raw(), send: f.send}; await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"}); const eventId = f.raw().airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId}); let job = f.raw().airpDirector!.jobs.at(-1)!;
  job = await directorOutput(wf, job, "writing", "艾洛拉：我听见你的回应了。");
  job = await directorOutput(wf, job, "formatting", formatted(false)); await f.send({type: "airp-director-show", jobId: job.id});
  const session = new GameSession(f.runtime, {saveId: "formal-airp", epoch: "epoch:1"}, {getItem: () => null, setItem() {}, removeItem() {}}, () => {}); await session.refresh();
  const wrapper = ({children}: {children: ReactNode}) => <GameSessionScope session={session}>{children}</GameSessionScope>;
  const hook = renderHook(useDirector, {wrapper});
  const evaluation = JSON.stringify({complete: true, reason: "已经回答", unresolved: [], next: null});
  mock.gmOutputs = [evaluation, evaluation];
  mock.outputs = ["艾洛拉：我听见你的回应了。", formatted(false), "艾洛拉：请去第三层，带回后找我交付。", formatted(false)];
  await act(async () => { await hook.result.current.send({type: "airp-director-respond", jobId: job.id, index: 0}); await hook.result.current.advance({type: "airp-director-read", jobId: job.id, cursor: 0}); });
  const reading = f.raw().airpDirector!.reading!;
  const nextJob = f.raw().airpDirector!.jobs.find(j => j.id === reading.jobId)!;
  expect(nextJob.lowContextVersion).toBe(21);
  expect(nextJob.scene!.dialogue!.previousRead).toHaveLength(1);
  expect(f.raw().airpDirector!.jobs.find(j => j.id === job.id)!.lowFrame).toEqual(job.lowFrame);
  expect(job.lowContextVersion).toBe(12);
  expect(mock.calls).toEqual(["writing", "formatting", "scene-evaluate"]); expect(reading.jobId).not.toBe(job.id);
  expect(f.raw().airpDirector!.cursors[reading.jobId]).toBe(0); expect(reading.paused).toBe(false);
  expect(f.raw().airpDirector!.events[0].status).toBe("offered");
  await act(async () => {await hook.result.current.advance({type: "airp-director-read", jobId: reading.jobId, cursor: 0}); await hook.result.current.advance({type: "airp-director-choose", eventId, choiceId: "participate"});});
  expect(mock.calls).toEqual(covered ? ["writing", "formatting", "scene-evaluate"] : ["writing", "formatting", "scene-evaluate", "writing", "formatting", "scene-evaluate"]);
  const acceptance = f.raw().airpDirector!.reading!;
  if (covered) {
    expect(acceptance.jobId).toBe(nextJob.id);
    expect(f.raw().airpDirector!.events[0].narrativeSkips).toHaveLength(1);
  } else {
    expect(f.raw().airpDirector!.jobs.find(j => j.id === acceptance.jobId)?.scene?.role).toBe("acceptance");
    expect(f.raw().airpDirector!.cursors[acceptance.jobId]).toBe(0);
    await act(async () => {await hook.result.current.advance({type: "airp-director-read", jobId: acceptance.jobId, cursor: 0});});
  }
  expect(f.raw().airpDirector!.reading?.completed).toBe(true);
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", actionPhase: 2});
  session.dispose();
}, 90000);
