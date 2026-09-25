import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { SHOP_AIRP_CATALOG } from "../../game-runtime/shop-wave-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { readD5Archive } from "../versions/d5-validate";
import type { AirpReplayInput } from "../versions/airp-boundary";
import { projectGMContext, selectGMDocuments, resolveGMDocuments } from "./gm-context";
import { projectDirectorScene } from "./context";
import { compileDirectorJob } from "./jobs";
import { directorLowFrame } from "./low";
import { SCENE_GM_TURN_PROMPT } from "./scene-gm";
import { DIRECTOR_RUNTIME_LIMITS } from "./contracts";
import { utf8Size } from "../../game-core/contracts";

async function setup() {
  const f = await formalAirpFixture(undefined, 24); await f.flow.sync();
  const material = directorTestMaterial(8);
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 17});
  const wf = {read: async () => f.raw(), send: f.send};
  const day = await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const event = () => f.raw().airpDirector!.events[0];
  await f.send({type: "airp-director-open", eventId: event().id});
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  const input = (): AirpReplayInput => { const r = f.raw(); return {head: r.head, before: r.snapshot.campaign, after: r.snapshot.campaign,
    run: null, facts: r.facts, group: [], retracted: r.retractedFactIds}; };
  const body = async () => {
    const lines = [{speaker: "elora", emotion: "neutral", text: "能听我说一件事吗？"}, {speaker: "elora", emotion: "smile", text: "是关于那只药箱的。"}];
    await directorOutput(wf, job(), "writing", lines.map(l => `艾洛拉：${l.text}`).join("\n"));
    await directorOutput(wf, job(), "formatting", JSON.stringify({lines, choices: ["认真倾听", "轻松回应", "有所保留"]}));
  };
  return {...f, material, wf, day, event, job, input, body};
}

it("context17 freezes independent complete GM cards/day/tasks without changing r8, NPC scope or completion policy", async () => {
  const f = await setup(), j = f.job(), global = j.gmContext!;
  expect(global.version).toBe(1); expect(global.sourceHead).toEqual(j.scene!.head);
  expect(j.planning).toBeNull(); expect(global.dayPlans[0].jobId).toBe(f.day.id);
  expect(global.tasks[0]).toEqual(f.event());
  expect(global.dayPlans[0].entryIds).toContain(f.event().id);
  expect(global.dayPlans[0].proposal).toEqual(f.day.proposal);
  const sources = resolveGMDocuments(global, f.material.resources.sources);
  for (const id of ["elora", "eustice", "norma", "kororo"]) expect(sources).toContainEqual(lowR8Source.sources.find(s => s.id === id));
  expect(j.lowFrame).toEqual(directorLowFrame(lowR8Source, j.scene!, 16, 6));
  expect(j.lowFrame!.sources.some(s => s.id === "norma")).toBe(false);
  const frozen = structuredClone(global); await f.body();
  const request = compileDirectorJob(f.material, f.job()), data = JSON.parse(request.messages[1].content);
  expect(request.stage).toBe("scene-evaluate"); expect(request.messages[0].content).toBe(SCENE_GM_TURN_PROMPT);
  expect(data.global).toEqual(frozen); expect(data.currentText).toHaveLength(2);
  expect(data.global.previousRead).toEqual([]); expect(data.taskGuidePresentation.readConfirmed).toBe(false);
  for (const s of sources) expect(request.messages.some(m => m.content.includes(s.text))).toBe(true);
  expect(request.messages.some(m => m.content.includes("<content_constraints>"))).toBe(false);
  expect(request.bytes).toBeLessThan(2 * 1024 * 1024);
  const dayJob = f.raw().airpDirector!.jobs.find(j => j.id === f.day.id)!;
  const dayRequest = compileDirectorJob(f.material, {...dayJob, proposal: null});
  expect(JSON.parse(dayRequest.messages[1].content).global).toEqual(dayJob.gmContext);
  const stateBytes = utf8Size(JSON.stringify(f.raw().airpDirector));
  const globalBytes = utf8Size(JSON.stringify(global));
  const originalsBytes = sources.reduce((n, s) => n + utf8Size(s.text), 0);
  expect(stateBytes).toBeLessThan(DIRECTOR_RUNTIME_LIMITS.stateBytes);
  expect(global.documents.every(d => Object.keys(d).sort().join(",") === "id,sha256")).toBe(true);
  console.info(JSON.stringify({kind: "GM-S1 synthetic content24 input/storage, no live calls", sources: sources.length,
    originalsBytes, globalBytes, sceneGMBytes: request.bytes, dayGMBytes: dayRequest.bytes, directorStateBytes: stateBytes,
    directorStateLimit: DIRECTOR_RUNTIME_LIMITS.stateBytes}));
  await f.send({type: "airp-director-configure", material: f.material, lowContextVersion: 16});
  expect(compileDirectorJob(f.material, f.job())).toEqual(request);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, SHOP_AIRP_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);

it("global projection includes other actors' tasks/memory but source triggers do not recurse through cards or future plans", async () => {
  const f = await setup(), state = f.raw().airpDirector!, input = f.input();
  const privateMemory = {id: "fixture:norma-private", text: "模拟：凯尔与诺玛已约定核对旧事项。", phase: 2, knownBy: ["kael", "norma"], evidenceIds: [input.facts.at(-1)!.id]};
  state.memories.push(privateMemory);
  const other = structuredClone(state.events[0]); other.id = "fixture:other-event"; other.status = "planned"; other.card.giverId = "norma";
  state.events.push(other);
  const context = projectGMContext(SHOP_AIRP_CATALOG, state, input);
  expect(context.memories).toContainEqual(privateMemory); expect(context.tasks[1].card.actions).toEqual(other.card.actions);
  expect(projectDirectorScene(SHOP_AIRP_CATALOG, state, state.events[0], input).memories).not.toContainEqual(privateMemory);
  const base = lowR8Source.sources.find(s => s.kind === "world")!;
  const world = {...base, id: "fixture:conditional", activation: {always: false, keywords: ["S1_TRIGGER_ONLY"]}};
  const actor = lowR8Source.sources.find(s => s.id === "norma")!;
  const modifiedActor = {...actor, text: actor.text + "\nS1_TRIGGER_ONLY"};
  // The trigger engine must not inspect already-loaded original character text.
  const sources = lowR8Source.sources.filter(s => s.id !== actor.id);
  const {sha256} = await import("../../game-core/contracts"); modifiedActor.sha256 = sha256(modifiedActor.text);
  sources.push(modifiedActor, world);
  expect(selectGMDocuments(sources, context, "当前交谈").some(s => s.id === world.id)).toBe(false);
  expect(selectGMDocuments(sources, context, "S1_TRIGGER_ONLY").some(s => s.id === world.id)).toBe(true);
  expect(f.raw().airpDirector!.memories).not.toContainEqual(privateMemory);
}, 60000);

it("GM history contains only actual read paragraphs; frozen current text and choices do not become memories", async () => {
  const f = await setup(); await f.body();
  await directorOutput(f.wf, f.job(), "scene-evaluate", JSON.stringify({complete: false, reason: "模拟，等待回应", unresolved: ["待回应"], next: {pacing: "brief", suggestedWords: 80, focus: "回应", alreadyCovered: [], stopWhen: "已回应", reason: "模拟"}}));
  const id = f.job().id;
  expect(projectGMContext(SHOP_AIRP_CATALOG, f.raw().airpDirector!, f.input()).previousRead).toEqual([]);
  await f.send({type: "airp-director-show", jobId: id}); await f.send({type: "airp-director-read", jobId: id, cursor: 0});
  const global = projectGMContext(SHOP_AIRP_CATALOG, f.raw().airpDirector!, f.input());
  expect(global.previousRead).toEqual([expect.objectContaining({sceneId: id, text: "elora：能听我说一件事吗？", readCount: 1, complete: false})]);
  expect(global.memories.some(m => m.id === `memory:${id}`)).toBe(false);
  expect(f.job().gmContext!.previousRead).toEqual([]);
  expect(f.raw().airpGame!.settlement.memories).toEqual([]);
}, 60000);
