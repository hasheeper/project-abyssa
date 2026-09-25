import {expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {formalAirpFixture} from "../testing/airp-game-fixture";
import {directorTestMaterial} from "../testing/airp-director-fixture";
import {directorOutput, directorPlan} from "../testing/airp-director-playthrough";
import {HOUSEHOLD_RESIDENT_CAST} from "../../content/gameplay/airp-director/residents";
import {DIRECTOR_FIXED_CARDS} from "../../content/gameplay/airp-director/content";
import {householdDirectorDocuments} from "../../content/presentation/airp/household-documents";
import {householdLowR8Source, lowR8Source} from "../../content/presentation/airp/low-r8-source";
import {ESTATE_AIRP_CATALOG} from "../../game-runtime/estate-context";
import {directorView} from "../../game-runtime/airp-director-view";
import {D5_RUN_READERS, createD5ExpeditionEngine} from "../../game-core/session";
import {sha256} from "../../game-core/contracts";
import {readD5Archive} from "../versions/d5-validate";
import {emptySettlementProposal} from "../airp-settlement/context";
import {emptyUsage} from "../airp-generation/contracts";
import {parseDirectorCommand} from "./parse";
import {compileDirectorJob} from "./jobs";

const material = () => ({...directorTestMaterial(8), resources: {...directorTestMaterial(8).resources, sources: structuredClone(householdDirectorDocuments)}});
const configuration = () => ({type: "airp-director-configure" as const, material: material(), lowMaterial: householdLowR8Source,
  lowReadVersion: 6 as const, lowContextVersion: 21 as const, residentCast: HOUSEHOLD_RESIDENT_CAST});
async function setup() {
  const f = await formalAirpFixture(undefined, 28);
  await f.flow.sync(); // An existing four-person host must upgrade without resetting its state.
  await f.send(configuration()); await f.flow.sync();
  return {...f, wf: {read: async () => f.raw(), send: f.send}};
}
async function archive(f: Awaited<ReturnType<typeof setup>>) {
  const result = await f.runtime.application.exportSave("formal-airp"); if (!result.ok) throw Error("export");
  expect(readD5Archive(result.archive, ESTATE_AIRP_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}

it("loads intact two-character originals and guidance while preserving the legacy material and catalog", () => {
  for (const source of householdDirectorDocuments) {
    expect(source.sha256).toBe(sha256(source.text));
    expect(source.text).toBe(readFileSync(source.path, "utf8"));
  }
  expect(lowR8Source.sources.some(s => s.id === "abyssa")).toBe(false);
  expect(ESTATE_AIRP_CATALOG.data.airpDirector!.capabilities.actorIds).toHaveLength(4);
  const guide = householdLowR8Source.sources.find(s => s.id === "household-guidance")!;
  expect(guide.activation?.always).toBe(true);
  expect(guide.text).toContain("随机库"); expect(guide.text).toContain("固定库");
  expect(guide.text).toContain("不按日期轮播");
});

it("opts in at a replayable mansion checkpoint without unlocking combat or overwriting saved day frames", async () => {
  const f = await formalAirpFixture(undefined, 28); await f.flow.sync();
  await f.send({type: "airp-director-configure", material: directorTestMaterial(8), lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 21});
  await f.send({type: "airp-director-prepare-day"});
  const original = f.raw().airpDirector!.jobs[0], combat = f.raw().snapshot.campaign.availableCharacterIds;
  await f.send(configuration()); await f.flow.sync();
  const view = directorView(f.raw())!;
  expect(view.context.capabilities.actorIds).toHaveLength(6);
  expect(view.context.world.availableActorIds).toEqual(expect.arrayContaining(["marietta", "abyssa"]));
  expect(f.raw().snapshot.campaign.availableCharacterIds).toEqual(combat);
  expect(combat).not.toContain("marietta"); expect(combat).not.toContain("abyssa");
  for (const id of ["marietta", "abyssa"]) expect(() => createD5ExpeditionEngine(ESTATE_AIRP_CATALOG).create(f.raw().snapshot.campaign, {...f.departure, partyIds: ["kael", id]})).toThrow();
  expect(f.raw().airpDirector!.jobs[0]).toEqual(original);
  expect(f.raw().airpGame!.settlement.policy.actorIds).toEqual(expect.arrayContaining(["marietta", "abyssa"]));
  await archive({...f, wf: {read: async () => f.raw(), send: f.send}});
}, 120000);

it("accepts an empty day and shares six full cards with expedition GM without placing residents in the party", async () => {
  const f = await setup();
  const day = await directorPlan(f.wf, null);
  expect(day.gmContext!.capabilities.actorIds).toHaveLength(6);
  expect(day.planning!.fixed).toHaveLength(3);
  const request = compileDirectorJob(material(), {...day, proposal: null});
  for (const id of ["marietta", "abyssa", "household-guidance"]) expect(request.messages.some(m => m.content.includes(householdDirectorDocuments.find(s => s.id === id)!.text))).toBe(true);
  expect(f.raw().airpDirector!.events).toEqual([]);
  await f.flow.prepare(f.departure);
  const frame = (await f.flow.gm.read()).ledger.jobs.at(-1)!.frames[0];
  for (const id of ["marietta", "abyssa"]) expect(frame.documents.some(d => d.id === id && d.kind === "character")).toBe(true);
  expect(frame.context.rules.departure.partyIds).not.toContain("abyssa");
  await archive(f);
}, 120000);

it.each(["marietta", "abyssa"])("runs %s through a free vignette, player response, settlement and save replay", async actorId => {
  const f = await setup(), locationId = actorId === "marietta" ? "dining" : "terrace";
  const card = {...structuredClone(DIRECTOR_FIXED_CARDS.find(f => f.card.form === "vignette")!.card),
    id: `test.${actorId}.small-question`, title: "日常小问", giverId: actorId, actorIds: [actorId], locationId,
    themeKey: `test.${actorId}.small-question`, themeDescription: "关于一项日常用法的新问题", synopsis: "一次没有跑腿任务的交谈", motivation: "想听听实际使用者的想法"};
  await directorPlan(f.wf, {kind: "free", card});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  expect(directorView(f.raw())!.entrances).toEqual(expect.arrayContaining([expect.objectContaining({actorId, locationId})]));
  const name = actorId === "marietta" ? "玛丽埃塔" : "艾比希斯";
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  async function scene() {
    await f.send({type: "airp-director-open", eventId});
    for (let turn = 0; turn < 3; turn++) {
      const j = job();
      expect(j.lowFrame!.scene.actors).toEqual({[actorId]: name});
      expect(j.lowFrame!.sources.find(s => s.id === actorId)?.text).toBe(householdDirectorDocuments.find(s => s.id === actorId)!.text);
      expect(j.lowFrame!.sources.some(s => s.id === (actorId === "marietta" ? "abyssa" : "marietta"))).toBe(false);
      await directorOutput(f.wf, j, "writing", `${name}：我听见你的回答了。`);
      await directorOutput(f.wf, job(), "formatting", JSON.stringify({lines: [{speaker: actorId, emotion: "neutral", text: "我听见你的回答了。"}], choices: ["认真回应", "轻松回应", "暂且保留"]}));
      await directorOutput(f.wf, job(), "scene-evaluate", JSON.stringify({complete: true, reason: "本次提问已回应", unresolved: [], next: null}));
      const ready = job();
      await f.send({type: "airp-director-show", jobId: ready.id});
      if (ready.lowChoices?.length) await f.send({type: "airp-director-respond", jobId: ready.id, index: 0});
      await f.send({type: "airp-director-read", jobId: ready.id, cursor: 0});
      if (ready.lowPhase!.complete) return;
    }
    throw Error("Dialogue did not end");
  }
  const loot = f.raw().snapshot.campaign.loot;
  await scene(); await f.send({type: "airp-director-choose", eventId, choiceId: "participate"});
  await scene(); await scene();
  expect(f.raw().airpDirector!.events[0].status).toBe("resolved");
  const task = await f.flow.settleHome(), boundary = (await f.flow.settlement.read()).ledger.jobs.find(j => j.id === task)!.frames[0];
  expect(boundary.materials.cards.find(c => c.actorId === actorId)!.text).toBe(householdDirectorDocuments.find(s => s.id === actorId)!.text);
  const input = boundary.input, proposal = emptySettlementProposal(input), fact = input.evidence.find(e => e.kind === "program-fact" && e.role === "current")!;
  proposal.affinity = [{grantId: input.grants.find(g => g.kind === "affinity")!.id, gradeId: "closer", reason: "实际回应增进了解", basisIds: [fact.id]}];
  proposal.memory.points = [{kind: "fact", text: "日常提问得到回应。", speakerId: null, knownBy: ["kael", actorId], basisIds: [fact.id]}];
  await f.flow.settlement.begin(task, {id: "test-assessment", model: "fixture", connectionHash: "3".repeat(64), at: 1});
  await f.flow.settlement.result({jobId: task, attemptId: "test-assessment", output: JSON.stringify(proposal), usage: emptyUsage(), at: 2});
  await f.flow.settlement.apply(task);
  expect(f.raw().airpGame!.settlement.state.affinity).toContainEqual({actorId, value: 1});
  expect(directorView(f.raw())!.context.memories.some(m => m.text.includes("日常提问得到回应"))).toBe(true);
  expect(f.raw().snapshot.campaign.loot).toEqual(loot);
  await archive(f);
}, 120000);

it("rejects unknown residents, invalid locations, absent full sources and legacy opt-in", async () => {
  const bad = configuration();
  expect(() => parseDirectorCommand({...bad, residentCast: {version: 1, locations: {...bad.residentCast.locations, stranger: bad.residentCast.locations.abyssa}}})).toThrow();
  expect(() => parseDirectorCommand({...bad, residentCast: {version: 1, locations: {...bad.residentCast.locations, abyssa: {...bad.residentCast.locations.abyssa, day: "unknown-room"}}}})).toThrow();
  const f = await formalAirpFixture(undefined, 28);
  bad.material.resources.sources = bad.material.resources.sources.filter(s => s.id !== "marietta");
  await expect(f.send(bad)).rejects.toThrow(/originals/);
  const legacy = await formalAirpFixture(); await expect(legacy.send(configuration())).rejects.toThrow(/checkpoint/);
});
