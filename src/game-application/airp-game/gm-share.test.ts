import { expect, it } from "vitest";
import { formalAirpFixture, formalNodeText, formalRead, formalSettle } from "../testing/airp-game-fixture";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { directorPlan } from "../testing/airp-director-playthrough";
import { clcProposal } from "../testing/airp-expedition-gm-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { SHOP_AIRP_CATALOG } from "../../game-runtime/shop-wave-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { emptyUsage } from "../airp-generation/contracts";
import { readD5Archive } from "../versions/d5-validate";
import { projectGMContext } from "../airp-director/gm-context";
import { compileExpeditionRequest } from "../airp-expedition-gm/context";
import { readGMShare } from "./gm-share";
import { utf8Size } from "../../game-core/contracts";

async function setup(version: 16 | 17 = 17) {
  const f = await formalAirpFixture(undefined, 24); await f.flow.sync();
  const material = directorTestMaterial(8);
  const configure = (lowContextVersion: 16 | 17) => f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion});
  await configure(version);
  const global = () => { const r = f.raw(), c = r.snapshot.campaign; return projectGMContext(SHOP_AIRP_CATALOG, r.airpDirector!, {
    head: r.head, before: c, after: c, run: r.snapshot.run?.kind === "expedition" ? r.snapshot.run.state : null,
    facts: r.facts, group: [], retracted: r.retractedFactIds}); };
  const share = () => readGMShare(f.raw().facts, f.raw().retractedFactIds);
  const replay = async () => { const a = await f.runtime.application.exportSave("formal-airp"); if (!a.ok) throw Error("export");
    expect(readD5Archive(a.archive, SHOP_AIRP_CATALOG, D5_RUN_READERS)).toEqual(f.raw()); };
  return {...f, material, configure, global, share, replay};
}

it("new expedition GM sees full resident cards/day/tasks; retry and refresh keep the correct historical plan", async () => {
  const f = await setup();
  await directorPlan({read: async () => f.raw(), send: f.send}, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const id = await f.flow.prepare(f.departure), packet = await f.flow.gm.read(), frame = packet.ledger.jobs[0].frames[0];
  expect(frame.context.gmContext!.tasks[0].card.actions).toEqual(f.raw().airpDirector!.events[0].card.actions);
  expect(frame.context.gmContext!.dayPlans).toHaveLength(1);
  for (const actor of ["elora", "eustice", "norma", "kororo"]) {
    expect(frame.documents.find(d => d.id === actor)?.text).toBe(lowR8Source.sources.find(s => s.id === actor)!.text);
  }
  expect(f.share()!.plans).toEqual([]); // No unaccepted proposal is a plan.
  const metadata = {stage: "plan" as const, model: "test-mock", connectionHash: "1".repeat(64), at: 1};
  const request = await f.flow.gm.begin(id, {...metadata, id: "interrupted"});
  console.info(JSON.stringify({kind: "GM-S1 synthetic expedition input/storage, no live calls", sources: frame.documents.length,
    requestBytes: utf8Size(JSON.stringify(request.messages)), frameBytes: utf8Size(JSON.stringify(frame)),
    gameStateBytes: utf8Size(JSON.stringify(f.raw().airpGame))}));
  await f.flow.gm.fail(id, "interrupted", 2);
  const retry = await f.flow.gm.begin(id, {...metadata, id: "retry", at: 3});
  expect(retry).toEqual(request);
  const proposalA = clcProposal(await f.flow.gm.read());
  await f.flow.gm.result(id, "retry", JSON.stringify(proposalA), emptyUsage(), 4);
  expect(f.share()!.plans).toEqual([]);
  await f.flow.gm.accept(id);
  const planA = structuredClone(f.share()!.plans[0]);
  expect(planA.status).toBe("accepted"); expect(planA.departure).not.toHaveProperty("seed");
  expect(f.raw().snapshot.run).toBeNull();
  await f.send({type: "airp-director-open", eventId: f.raw().airpDirector!.events[0].id});
  const scene = f.raw().airpDirector!.jobs.at(-1)!;
  expect(scene.gmContext!.expedition!.plans).toEqual([planA]);
  await f.flow.gm.refresh(id);
  expect(f.share()!.plans).toEqual([]);
  const refreshed = await f.flow.gm.read(), proposalB = clcProposal(refreshed); proposalB.focus.intent += "（显式重排）";
  await f.flow.gm.begin(id, {...metadata, id: "replacement", at: 5});
  await f.flow.gm.result(id, "replacement", JSON.stringify(proposalB), emptyUsage(), 6); await f.flow.gm.accept(id);
  expect(f.share()!.plans[0].frameIndex).toBe(1);
  expect(f.global().expedition!.plans[0].proposal).toEqual(proposalB);
  expect(f.raw().airpDirector!.jobs.find(j => j.id === scene.id)!.gmContext!.expedition!.plans).toEqual([planA]);
  await f.flow.gm.cancel(id); expect(f.share()!.plans).toEqual([]);
  expect(compileExpeditionRequest(f.raw().airpGame!.gm.jobs[0].frames[0], 0)).toEqual(request);
  await f.replay();
}, 120000);

it("legacy plans stay byte-identical across read-only reopen and explicit context17 opt-in", async () => {
  const f = await setup(16), id = await f.prepare();
  const legacy = structuredClone(f.raw().airpGame!.gm.jobs[0].frames[0]), before = f.raw();
  expect(legacy.context.gmContext).toBeUndefined(); expect(f.share()).toBeNull();
  expect((await f.runtime.application.open("formal-airp")).ok).toBe(true); await f.flow.sync();
  expect(f.raw()).toEqual(before);
  await f.configure(17);
  expect(f.share()!.plans[0].jobId).toBe(id);
  expect((await f.flow.gm.read()).context.gmContext).toBeUndefined();
  expect(f.raw().airpGame!.gm.jobs[0].frames[0]).toEqual(legacy);
  // Downgrading only affects new jobs, not the already-published read-only history.
  await f.configure(16); await f.flow.gm.cancel(id);
  expect(f.share()!.plans).toEqual([]); await f.configure(17);
  f.departure.runId = "formal-run:2"; await f.flow.prepare(f.departure);
  expect((await f.flow.gm.read()).context.gmContext!.version).toBe(1);
  expect(f.raw().airpGame!.gm.jobs[0].frames[0]).toEqual(legacy);
  await f.replay();
}, 120000);

it("GM distinguishes accepted plans, actual departure and partial node reading, without another model call", async () => {
  const f = await setup(), id = await f.prepare(), ticket = await f.flow.gm.departurePermit(id);
  expect(f.global().activity.activeRun).toBeNull(); expect(f.share()!.plans[0].status).toBe("accepted");
  await f.send({type: "start-expedition", ...ticket.departure});
  expect(f.global().activity.activeRun!.id).toBe(f.departure.runId);
  expect(f.global().activity.activeRun).toMatchObject({layer: 1, roomIndex: 0});
  for (const actorId of f.departure.partyIds.filter(id => id !== "kael")) expect(f.global().actorPresence).toContainEqual({actorId, locationId: null, basis: "active-expedition"});
  expect(f.share()!.plans[0].status).toBe("accepted"); // Host recovery has not bound the real departure yet.
  await f.flow.sync(); expect(f.share()!.plans[0].status).toBe("started");
  const node = (await f.flow.nodes.read()).ledger.jobs[0]; await formalNodeText(f, node.id);
  expect(f.share()!.reads).toEqual([]);
  await f.flow.nodes.readLine(node.id, 0);
  const actual = (await f.flow.nodes.read()).ledger.jobs[0];
  expect(f.global().expedition!.reads).toEqual([expect.objectContaining({sceneId: node.id, text: `${actual.text!.lines[0].speaker}：${actual.text!.lines[0].text}`})]);
  const saved = f.raw(); await f.flow.sync(); await f.flow.gm.read();
  expect(f.raw()).toEqual(saved); expect(f.raw().airpGame!.gm.jobs[0].attempts).toHaveLength(1);
  await formalRead(f, node.id); const settlementId = await f.flow.settle(node.id);
  expect(f.global().expedition!.pendingSettlements).toEqual([expect.objectContaining({jobId: settlementId, status: "pending"})]);
  expect(f.global().settlement).toBeNull(); // Pending output is not an applied variable update.
  await formalSettle(f, node.id);
  expect(f.global().expedition!.pendingSettlements).toEqual([]);
  expect(f.global().settlement).toEqual({actors: [], affinity: []});
  expect(f.global().memories.some(m => m.text.includes("队伍抵达当前地点"))).toBe(true);
  await f.replay();
}, 120000);
