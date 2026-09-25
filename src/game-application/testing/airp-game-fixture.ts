import { ESTATE_AIRP_CATALOG } from "../../game-runtime/estate-context";
import { FACILITIES_AIRP_CATALOG } from "../../game-runtime/facilities-context";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { SHOP_AIRP_CATALOG } from "../../game-runtime/shop-wave-context";
import type { AnyGameRecord, AnyReceipt } from "../versions/demo-contracts";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import { clcProposal } from "./airp-expedition-gm-fixture";
import { emptyUsage } from "../airp-generation/contracts";
import { mockNodeWriting } from "./airp-node-fixture";
import { readLowWriting } from "../airp-low/output";
import { nodeWriting } from "../airp-expedition-play/context";
import { emptySettlementProposal } from "../airp-settlement/context";

export async function formalAirpFixture(routeId = AIRP_GAME_CATALOG.data.manor!.maintenanceRouteId, contentVersion: 22 | 24 | 26 | 28 = 22) {
  const catalog = contentVersion === 28 ? ESTATE_AIRP_CATALOG : contentVersion === 26 ? FACILITIES_AIRP_CATALOG : contentVersion === 24 ? SHOP_AIRP_CATALOG : AIRP_GAME_CATALOG;
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let serial = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `formal:${++serial}`, newSeed: () => 19, close() {} });
  const result = await runtime.application.create({protocolVersion: 4, contentVersion, profileId: "profile.demo.first-run", saveId: "formal-airp", epoch: "epoch:1", clientRequestId: "create-formal"});
  if (!result.ok) throw Error(JSON.stringify(result.error));
  const raw = () => structuredClone(database.records.get("formal-airp")! as D5GameRecord);
  const flow = runtime.airpGame.forSave("formal-airp", contentVersion);
  const departure = { ...(contentVersion >= 26 ? {supplyQuantities: {"item.food": 1, "item.potion": 1}} : {}), runId: "formal-run:1", routeId, partyIds: [...catalog.data.initialParty], itemIds: ["item.food", "item.potion"], seed: 19 };
  const send = async (command: D5Command) => {
    const request = { protocolVersion: 4, saveId: "formal-airp", expectedHead: raw().head, clientRequestId: `test:${++serial}`, command };
    const r = await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn(request) : runtime.application.dispatch(request));
    if (!r.ok) throw Error(JSON.stringify(r.error)); return r;
  };
  await send({type: "select-game-start", startAt: "airp-director"});
  const prepare = async (programStop = false, entryProgramStop = false) => {
    const id = await flow.prepare(departure), s = await flow.gm.read();
    const p = clcProposal(s); const basisIds = p.focus.basisIds;
    p.nodes = [{ id: "entry", slotId: "slot:1:0:arrive", intent: "眼前是刚抵达的入口，等待玩家回应。", actorIds: departure.partyIds, basisIds, actionIds: entryProgramStop ? ["continue"] : [], prerequisites: [], link: null, stop: entryProgramStop ? "program" : "scene-end", itemKeys: [] },
      { id: "cleared", slotId: "slot:1:0:cleared", intent: "第一场战斗已结束，承接实际情况。", actorIds: departure.partyIds, basisIds, actionIds: programStop ? ["continue"] : [], prerequisites: [{ nodeId: "entry", outcome: "completed" }], link: null, stop: programStop ? "program" : "scene-end", itemKeys: [] }];
    await flow.gm.begin(id, { id: "gm:1", stage: "plan", model: "test-mock", connectionHash: "1".repeat(64), at: 1 });
    await flow.gm.result(id, "gm:1", JSON.stringify(p), emptyUsage(), 2); await flow.gm.accept(id); return id;
  };
  return { database, store, runtime, flow, raw, send, departure, prepare };
}

export async function formalNodeText(f: Awaited<ReturnType<typeof formalAirpFixture>>, id: string) {
  await f.flow.nodes.open(id);
  for (const stage of ["writing", "formatting"] as const) {
    const j = (await f.flow.nodes.read()).ledger.jobs.find(j => j.id === id)!;
    await f.flow.nodes.begin(id, { id: stage, stage, model: "test-mock", connectionHash: "2".repeat(64), at: 3 });
    await f.flow.nodes.result(id, stage, stage === "writing" ? mockNodeWriting() : JSON.stringify(readLowWriting(nodeWriting(j), j.frame!).text), emptyUsage(), 4);
  }
}
export async function formalRead(f: Awaited<ReturnType<typeof formalAirpFixture>>, id: string) {
  const j = (await f.flow.nodes.read()).ledger.jobs.find(j => j.id === id)!;
  for (let i = j.reads.length; i < j.text!.lines.length; i++) await f.flow.nodes.readLine(id, i);
  await f.flow.nodes.choose(id, 0);
}
export async function formalSettle(f: Awaited<ReturnType<typeof formalAirpFixture>>, id: string) {
  const packet = await f.flow.nodes.settlementInput(id), task = await f.flow.settle(id);
  const p = emptySettlementProposal(packet.input), fact = packet.input.evidence.find(e => e.kind === "program-fact")!, claim = packet.input.evidence.find(e => e.authority === "claim")!;
  p.memory.points = [{ kind: "fact", text: "队伍抵达当前地点，艾洛拉问是否准备出发。", speakerId: null, knownBy: claim.knownBy, basisIds: [fact.id, claim.id] }];
  await f.flow.settlement.begin(task, { id: "settle", model: "test-mock", connectionHash: "3".repeat(64), at: 5 });
  await f.flow.settlement.result({ jobId: task, attemptId: "settle", output: JSON.stringify(p), usage: emptyUsage(), at: 6 });
  await f.flow.settlement.apply(task); await f.flow.nodes.complete(id); return task;
}
