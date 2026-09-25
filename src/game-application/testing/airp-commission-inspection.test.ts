import { validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import {expect, it} from "vitest";
import {commissionFixture} from "./airp-commission-fixture";
import {directorCommissions} from "../../game-runtime/airp-commission-view";
import {MemoryGameDatabase, MemoryGameStore} from "../../game-infrastructure/storage/memory";
import {createPlayerRuntime} from "../../game-runtime/player-runtime";
import type {AnyGameRecord, AnyReceipt} from "../versions/demo-contracts";
import type {D5GameRecord} from "../versions/d5-contracts";
import {airpEligible} from "../versions/airp-boundary";
import {nextD5PlayCommand} from "./d5-playthrough";
import {SHOP_AIRP_CATALOG} from "../../game-runtime/shop-wave-context";
import {airpGameView} from "../../game-runtime/airp-game-runtime";
import {directorView} from "../../game-runtime/airp-director-view";
import {guardAirpGameCommand} from "../airp-game/validation";

it.each([false, true])("registers actual acceptance independently of unread feedback, upgrade=%s", async upgrade => {
  const f = await commissionFixture();
  expect(f.event()).toMatchObject({status: "offered", actionPhase: null});
  expect(directorCommissions(f.raw())![0]).toMatchObject({state: "offered", registered: false});
  await f.accept(upgrade);
  expect(f.event()).toMatchObject({status: "accepted", actionPhase: upgrade ? 2 : null});
  const readScenes = f.event().readSceneIds, cursors = f.raw().airpDirector!.cursors;
  // Both old and new archives remain replayable before any automatic repair.
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export failed");
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  const restored = createPlayerRuntime(new MemoryGameStore(db), {newId: () => "restore-test", newSeed: () => 19, close() {}});
  expect((await restored.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).ok).toBe(true);
  const restoredFlow = restored.airpGame.forSave("formal-airp", 24);
  await restoredFlow.host.registerCommissions();
  expect((await restoredFlow.host.read()).airpDirector!.events[0]).toMatchObject({status: "accepted", actionPhase: 2, binding: null});
  expect((await restoredFlow.host.read()).airpDirector!.cursors).toEqual(cursors);
  const {id, packet} = await f.preparePlan();
  expect(packet.context.rules.commissionRewardVersion).toBe(1);
  expect(packet.context.rules.itemTemplates).toHaveLength(1);
  expect(packet.context.rules.commissions).toHaveLength(1);
  expect(packet.context.rules.commissions[0]).toMatchObject({eventId: f.eventId, slotId: "slot:3:0:cleared"});
  expect(f.event().readSceneIds).toEqual(readScenes); expect(f.raw().airpDirector!.cursors).toEqual(cursors);
  const head = f.raw().head; await f.flow.host.registerCommissions(); expect(f.raw().head).toEqual(head);
  const permit = await f.flow.gm.departurePermit(id);
  const omitted = f.raw(); omitted.airpGame!.gm.jobs.find(j => j.id === id)!.frames.at(-1)!.context.rules.commissions = [];
  expect(() => guardAirpGameCommand(omitted, SHOP_AIRP_CATALOG, {type: "start-expedition", ...permit.departure})).toThrow(/本趟委托已变化/);
  const legacyPlan = f.raw(); delete legacyPlan.airpGame!.gm.jobs.find(j => j.id === id)!.frames.at(-1)!.context.rules.commissionRewardVersion;
  expect(() => guardAirpGameCommand(legacyPlan, SHOP_AIRP_CATALOG, {type: "start-expedition", ...permit.departure})).toThrow(/旧安排尚未包含委托物品/);
  await f.send({type: "start-expedition", ...permit.departure});
  const run = f.raw().snapshot.run;
  expect(run?.kind === "expedition" && f.event().binding!.roomId === run.state.run.roomIds[2][0]).toBe(true);
  expect(directorCommissions(f.raw())![0]).toMatchObject({state: "exploring", unreadAcceptance: true});
  expect(f.raw().snapshot.campaign.manor.takeover).toBeNull();
}, 60000);

it("keeps unmatched commissions pending while actually departing for free exploration", async () => {
  const f = await commissionFixture(); await f.accept();
  const {id, packet} = await f.preparePlan("tide-reef.ordinary");
  expect(packet.context.rules.commissions).toEqual([]);
  expect(directorCommissions(f.raw(), "tide-reef.ordinary")![0].state).toBe("elsewhere");
  const permit = await f.flow.gm.departurePermit(id); await f.send({type: "start-expedition", ...permit.departure});
  expect(f.event().binding).toBeNull(); expect(f.event().status).toBe("accepted");
  expect(directorCommissions(f.raw())![0].state).toBe("unbound");
}, 60000);

it.each(["extracted", "wipe"] as const)("unread acceptance completes the real patrol loop: %s", async outcome => {
  const f = await commissionFixture(); await f.accept(); const unread = f.raw().airpDirector!.reading!.jobId;
  const {id} = await f.preparePlan(), permit = await f.flow.gm.departurePermit(id);
  await f.send({type: "start-expedition", ...permit.departure}); await f.flow.sync();
  let sawTarget = false;
  for (let steps = 0; f.raw().snapshot.run && steps < 600; steps++) {
    const node = airpGameView(f.raw())?.node; if (node) await f.flow.nodes.skip(node.id);
    const command = nextD5PlayCommand(SHOP_AIRP_CATALOG, f.raw(), outcome === "wipe"), run = f.raw().snapshot.run;
    await f.send(command.type === "choose-exit" && run?.kind === "expedition" && run.state.run.layer >= 3 ? {...command, choice: "leave"} : command);
    await f.flow.sync();
    if (directorCommissions(f.raw())![0].state === "return") sawTarget = true;
    if (steps % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  expect(f.raw().snapshot.run).toBeNull(); expect(f.event().readSceneIds).not.toContain(unread);
  expect(f.raw().airpDirector!.reading).toBeNull();
  for (let i = 0; i < 8 && !directorView(f.raw())!.entrances.some(e => e.event.id === f.eventId); i++) await f.send({type: "advance-phase"});
  if (outcome === "extracted") {
    expect(sawTarget).toBe(true); expect(directorCommissions(f.raw())![0].state).toBe("delivery");
    const inventory = f.raw().airpDirector!.questItems!;
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({status: "owned", deliveredFactId: null, item: {label: "空药箱", eventId: f.eventId, runId: f.departure.runId}});
    expect(f.event().delivery?.itemInstanceId).toBe(inventory[0].item.instanceId);
    const grants = f.raw().facts.flatMap(f => f.kind === "journey" ? f.payload.events : []).filter(e => e.type === "commission-item-found");
    expect(grants).toHaveLength(1);
    const tampered = f.raw(); tampered.airpDirector!.questItems = [];
    expect(() => validateD5Record(tampered, SHOP_AIRP_CATALOG, D5_RUN_READERS)).toThrow(/Director differs/);
    const loot = f.raw().snapshot.campaign.loot;
    await f.send({type: "airp-director-deliver", eventId: f.eventId});
    expect(f.raw().snapshot.campaign.loot).toEqual(loot);
    expect(f.raw().airpDirector!.questItems).toHaveLength(1);
    expect(f.raw().airpDirector!.questItems![0]).toMatchObject({status: "delivered", item: inventory[0].item});
    const consumed = f.raw().airpDirector!.questItems;
    await f.send({type: "airp-director-deliver", eventId: f.eventId});
    expect(f.raw().airpDirector!.questItems).toEqual(consumed);
    expect(validateD5Record(f.raw(), SHOP_AIRP_CATALOG, D5_RUN_READERS).airpDirector!.questItems).toEqual(consumed);
    expect(directorCommissions(f.raw())![0].state).toBe("result");
  } else {
    expect(f.event()).toMatchObject({status: "feedback", actionOutcome: "failed"});
    expect(f.event().delivery).toBeUndefined();
    await expect(f.send({type: "airp-director-deliver", eventId: f.eventId})).rejects.toThrow();
    await f.send({type: "airp-director-open", eventId: f.eventId});
  }
  await f.readScene(); await f.flow.sync();
  expect(directorCommissions(f.raw())![0].state).toBe(outcome === "extracted" ? "complete" : "ready");
  await f.flow.useHomeProgramFacts();
  if (outcome === "wipe") {
    const retry = await f.preparePlan(f.departure.routeId, "retry-run");
    expect(retry.packet.context.rules.commissions).toHaveLength(1);
    const retryPermit = await f.flow.gm.departurePermit(retry.id);
    await f.send({type: "start-expedition", ...retryPermit.departure});
    expect(f.event().binding?.runId).toBe("retry-run");
  }
  const exported = await f.runtime.application.exportSave("formal-airp"); expect(exported.ok).toBe(true);
}, 180000);

it("keeps tutorial, first-clear and AIRP shortcut patrol access separate in formal24", async () => {
  for (const startAt of ["tutorial", "hub", "airp-director"] as const) {
    const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
    const runtime = createPlayerRuntime(store, {newId: () => "inspection-id", newSeed: () => 19, close() {}});
    const created = await runtime.application.create({protocolVersion: 4, contentVersion: 24, profileId: "profile.demo.first-run", saveId: startAt, epoch: "inspection", clientRequestId: "create"});
    expect(created.ok).toBe(true);
    const raw = () => database.records.get(startAt)! as D5GameRecord;
    const selected = await runtime.application.dispatch({protocolVersion: 4, saveId: startAt, expectedHead: raw().head, clientRequestId: "start", command: {type: "select-game-start", startAt}});
    expect(selected.ok).toBe(true);
    const record = raw(), destinations = runtime.queries.journey(record)!.destinations;
    expect(destinations.find(d => d.routeId === "old-manor.first-clear")!.available).toBe(startAt === "hub");
    expect(destinations.find(d => d.routeId === "old-manor.maintenance")!.available).toBe(startAt === "airp-director");
    expect(airpEligible(record.snapshot.campaign)).toBe(startAt === "airp-director");
    expect(record.snapshot.campaign.manor.takeover).toBeNull();
  }
}, 30000);
