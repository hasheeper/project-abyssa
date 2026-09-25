import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { directorLowFrame } from "./low";
import { directorSceneBrief } from "./scene-brief";
import { compileLowFrame } from "../airp-low/native";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { pendingHomeBoundary, homeSettlementPacket } from "../airp-game/home";
import { parseDirectorCommand } from "./parse";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { directorView } from "../../game-runtime/airp-director-view";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { emptySettlementProposal } from "../airp-settlement/context";
import { emptyUsage } from "../airp-generation/contracts";
import { clcProposal } from "../testing/airp-expedition-gm-fixture";

async function setup(cardId = "ripple.elora.old-medicine-case") {
  const f = await formalAirpFixture(); await f.flow.sync();
  await f.send({type: "airp-director-configure", material: directorTestMaterial(), lowMaterial: lowR8Source, lowReadVersion: 5, lowContextVersion: 10});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: cardId});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  async function generate() {
    await f.send({type: "airp-director-open", eventId});
    let job = f.raw().airpDirector!.jobs.at(-1)!;
    const text = {lines: [{speaker: job.scene!.actorIds[0], emotion: "neutral", text: "「先说眼前这件事。」"}], choices: ["认真听她说", "轻松接话", "暂持保留"]};
    job = await directorOutput(wf, job, "writing", text.lines[0].text);
    job = await directorOutput(wf, job, "formatting", JSON.stringify(text));
    await f.send({type: "airp-director-show", jobId: job.id});
    return job;
  }
  async function finish(id: string) {
    await f.send({type: "airp-director-respond", jobId: id, index: 2});
    await f.send({type: "airp-director-read", jobId: id, cursor: 0});
  }
  return {...f, wf, eventId, generate, finish};
}

it("v10 transmits all event meanings, isolates current author steps and preserves complete cards/r8", async () => {
  const f = await setup(), job = await f.generate(), frame = job.lowFrame!, scene = job.scene!;
  const data = JSON.parse(frame.scene.scenario);
  expect(data.eventBrief.title).toBe(scene.card.title);
  expect(data.eventBrief.requestReference.nodes.length).toBeGreaterThan(0);
  expect(data.activeAuthorScript.id).toContain("offer");
  expect(JSON.stringify(data)).not.toContain("return-cleared");
  const free = {...scene, authorSource: null}, changed = structuredClone(free);
  changed.card.title = "唯一标题标记"; changed.card.synopsis = "唯一事件概述";
  changed.card.motivation = "唯一动机"; changed.card.themeDescription = "唯一主题";
  const a = directorLowFrame(lowR8Source, free, 8, 5), b = directorLowFrame(lowR8Source, changed, 8, 5);
  expect(a.requestHash).not.toBe(b.requestHash);
  for (const text of [changed.card.title, changed.card.synopsis, changed.card.motivation, changed.card.themeDescription]) expect(JSON.stringify(b.messages)).toContain(text);
  for (const source of lowR8Source.sources.filter(s => s.kind === "player" || s.id === "elora")) {
    expect(frame.sources).toContainEqual(source); expect(frame.messages.some(m => m.content.includes(source.text))).toBe(true);
  }
  const old = directorLowFrame(lowR8Source, scene, 7, 5);
  expect(frame.trace).toEqual(old.trace); expect(frame.sampling).toEqual(old.sampling);
  const intermediate = directorLowFrame(lowR8Source, scene, 8, 5);
  expect(intermediate.scene.choiceMode).toBeUndefined();
  expect(intermediate.formatInstruction).not.toContain("任何一项都不得包含");
  expect(frame.formatInstruction).toContain("不修改正文");
  const returned = {...scene, role: "result" as const, progress: {...scene.progress!, delivery: {runId: "run:1", returnFactId: "fact:return", status: "confirmed" as const, confirmedFactId: "fact:deliver"}, runResult: {runId: "run:1", outcome: "extracted", deepestLayer: 3, partyIds: ["kael", "elora"]}}};
  expect(directorSceneBrief(returned).activeAuthorScript).not.toBeNull(); // Historical context9 is unchanged.
  expect(directorSceneBrief(returned, true).activeAuthorScript).toBeNull();
  returned.progress.runResult.partyIds = ["kael", "norma"];
  expect(directorSceneBrief(returned, true).activeAuthorScript).not.toBeNull();
  const source = lowR8Source.sources.find(s => s.kind === "world")!;
  const material = {...lowR8Source, sources: [...lowR8Source.sources, {...source, id: "test-future-book", activation: {always: false, keywords: ["FUTURE_BOOK_ONLY"]}}]};
  const selected = compileLowFrame(material, {...frame.scene, scenario: frame.scene.scenario + " FUTURE_BOOK_ONLY", sourceContext: {intent: "现在交谈", authorSource: "FUTURE_BOOK_ONLY"}}, true, 5);
  expect(selected.sources.some(s => s.id === "test-future-book")).toBe(false);
  expect(compileLowFrame(material, {...selected.scene, sourceContext: {intent: "FUTURE_BOOK_ONLY"}}, true, 5).sources.some(s => s.id === "test-future-book")).toBe(true);
}, 30000);

it("attitude cannot accept a task; explicit acceptance arms patrol without redundant scenes; save replay preserves both", async () => {
  const f = await setup(), offer = await f.generate();
  await expect(f.send({type: "airp-director-read", jobId: offer.id, cursor: 0})).rejects.toThrow();
  await f.send({type: "airp-director-respond", jobId: offer.id, index: 2});
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "offered", selected: [], actionPhase: null});
  await expect(f.send({type: "airp-director-respond", jobId: offer.id, index: 0})).rejects.toThrow();
  await f.send({type: "airp-director-read", jobId: offer.id, cursor: 0});
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", role: "action", actionPhase: 2, selected: [expect.objectContaining({id: "participate"})]});
  expect(f.raw().snapshot.run).toBeNull();
  expect(f.raw().airpDirector!.jobs.filter(j => j.kind === "scene").map(j => j.scene!.role)).toEqual(["offer"]);
  await expect(f.send({type: "airp-director-open", eventId: f.eventId})).rejects.toThrow();
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(offer.lowFrame!.requestHash).toBe(f.raw().airpDirector!.jobs.find(j => j.id === offer.id)!.lowFrame!.requestHash);
}, 30000);

it("a small vignette goes from actual acceptance to its result, and attitudes reach settlement as attitudes", async () => {
  const f = await setup("ripple.kororo.quiet-cup"), offer = await f.generate(); await f.finish(offer.id);
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.raw().airpDirector!.events[0].role).toBe("result");
  const result = await f.generate(); await f.finish(result.id); await f.flow.sync();
  expect(result.scene!.selectedAttitudes?.[0].text).toContain("暂持保留");
  expect(f.raw().airpDirector!.events[0].status).toBe("resolved");
  const packet = homeSettlementPacket(f.raw(), pendingHomeBoundary(f.raw())!);
  expect(packet.materials.evidence.filter(s => s.text.includes("回应态度"))).toHaveLength(2);
  expect(packet.input.lifecycle).toContainEqual(expect.objectContaining({kind: "event", id: f.eventId}));
}, 30000);

it("defer and decline remain explicit decisions; clients cannot inject arbitrary attitude text", async () => {
  const f = await setup(), offer = await f.generate(); await f.finish(offer.id);
  await f.send({type: "airp-director-defer", eventId: f.eventId});
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "offered", selected: [], deferredUntil: 3});
  await f.send({type: "advance-phase"});
  // Elora returns to this entrance on the next dusk, before this inert offer expires.
  for (let i = 0; i < 3; i++) await f.send({type: "advance-phase"});
  await f.send({type: "airp-director-open", eventId: f.eventId});
  await f.send({type: "airp-director-decline", eventId: f.eventId});
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "closed", closeReason: "declined", actionPhase: null});
  expect(() => parseDirectorCommand({type: "airp-director-respond", jobId: offer.id, index: 0, text: "已经完成委托"})).toThrow();
}, 30000);

it.each(["wipe", "extracted"] as const)("compact patrol %s: actual evidence determines delivery versus retry, never prose", async outcome => {
  const f = await setup(), offer = await f.generate(); await f.finish(offer.id);
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  const planId = await f.flow.prepare(f.departure), planned = clcProposal(await f.flow.gm.read());
  await f.flow.gm.begin(planId, {id: "closure-gm", stage: "plan", model: "mock", connectionHash: "1".repeat(64), at: 1});
  await f.flow.gm.result(planId, "closure-gm", JSON.stringify(planned), emptyUsage(), 2); await f.flow.gm.accept(planId);
  const permit = await f.flow.gm.departurePermit(planId);
  await f.send({type: "start-expedition", ...permit.departure}); await f.flow.sync();
  for (let steps = 0; f.raw().snapshot.run && steps < 600; steps++) {
    const node = airpGameView(f.raw())?.node; if (node) await f.flow.nodes.skip(node.id);
    const command = nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw(), outcome === "wipe"), run = f.raw().snapshot.run;
    await f.send(command.type === "choose-exit" && run?.kind === "expedition" && run.state.run.layer >= 3 ? {...command, choice: "leave"} : command);
    await f.flow.sync(); if (steps % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  expect(f.raw().snapshot.run).toBeNull();
  for (let i = 0; i < 8 && !directorView(f.raw())!.entrances.some(e => e.event.id === f.eventId); i++) await f.send({type: "advance-phase"});
  const event = () => f.raw().airpDirector!.events[0];
  if (outcome === "extracted") {
    expect(event()).toMatchObject({status: "ready", role: "result", delivery: {status: "pending"}});
    await f.send({type: "airp-director-open", eventId: f.eventId});
    expect(f.raw().airpDirector!.jobs.some(j => j.id === f.raw().airpDirector!.reading!.jobId)).toBe(false);
    const loot = f.raw().snapshot.campaign.loot;
    await f.send({type: "airp-director-deliver", eventId: f.eventId});
    expect(f.raw().snapshot.campaign.loot).toEqual(loot);
  } else {
    expect(event()).toMatchObject({status: "feedback", role: "feedback", actionOutcome: "failed"});
    expect(event().delivery).toBeUndefined();
    await expect(f.send({type: "airp-director-deliver", eventId: f.eventId})).rejects.toThrow();
  }
  const result = await f.generate(); await f.finish(result.id); await f.flow.sync();
  expect(event()).toMatchObject(outcome === "extracted" ? {status: "resolved"} : {status: "waiting-action", occurrence: 1});
  if (outcome === "wipe") expect(event().actionPhase).not.toBeNull();
  if (outcome === "extracted") expect(JSON.parse(result.lowFrame!.scene.scenario).activeAuthorScript).toBeNull();
  const id = await f.flow.settleHome(), job = (await f.flow.settlement.read()).ledger.jobs.find(j => j.id === id)!, input = job.frames[0].input;
  const proposal = emptySettlementProposal(input), basis = input.evidence.find(e => e.role === "current" && e.kind === "program-fact")!;
  proposal.memory.points = [{kind: "fact", text: outcome === "extracted" ? "测试：已交付并收尾。" : "测试：未带回目标，等待再次行动。", speakerId: null, knownBy: basis.knownBy, basisIds: [basis.id]}];
  await f.flow.settlement.begin(id, {id: "closure-test", model: "mock", connectionHash: "3".repeat(64), at: 1});
  await f.flow.settlement.result({jobId: id, attemptId: "closure-test", output: JSON.stringify(proposal), usage: emptyUsage(), at: 2});
  await f.flow.settlement.apply(id);
  expect(pendingHomeBoundary(f.raw())).toBeNull();
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);
