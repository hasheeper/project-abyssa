import { ESTATE_AIRP_CATALOG } from "./estate-context";
import { gameCommissionRewards } from "../game-application/airp-game/rewards";
import { FACILITIES_AIRP_CATALOG } from "./facilities-context";
import { SHOP_AIRP_CATALOG } from "./shop-wave-context";
import type { D5GameRecord, D5Receipt, D5Store, VersionedGameStore } from "../game-application";
import type { D5Departure } from "../game-core/session";
import { createAirpGameHost } from "../game-application/airp-game/host";
import { currentGamePlan, projectGameNode } from "../game-application/airp-game/projection";
import { createExpeditionGMService } from "../game-application/airp-expedition-gm/service";
import { createNodeService, nodeStage } from "../game-application/airp-expedition-play/service";
import { nodeBoundaryReady, nodeGate } from "../game-application/airp-expedition-play/context";
import { createSettlementService } from "../game-application/airp-settlement/service";
import { lowR8Source, householdLowR8Source } from "../content/presentation/airp/low-r8-source";
import { tibbyAppraisalReference } from "../content/presentation/airp/appraisal-reference";
import { AIRP_GAME_CATALOG } from "./airp-game-context";
import { createExpeditionGMDriver } from "./airp-expedition-gm-driver";
import { createNodeDriver } from "./airp-expedition-play-driver";
import { createSettlementDriver } from "./airp-settlement-driver";
import { parseModel, type ModelConfiguration } from "../game-application/airp-generation/contracts";
import { lowHash } from "../game-application/airp-low/native";
import { homeSettlementPacket, pendingHomeBoundary } from "../game-application/airp-game/home";
export { nodeStage } from "../game-application/airp-expedition-play/service";

/** Shared by normal map/battle pages. Configuration/keys are never part of the save. */
export function createAirpGameRuntime(store: VersionedGameStore) {
  const bridge: D5Store = { read: async id => await store.read(id) as D5GameRecord | null, listSaveIds: () => store.listSaveIds(),
    receipt: async (...args) => await store.receipt(...args) as D5Receipt | null,
    async commit(c) { const r = await store.commit(c); return { ...r, receipt: r.receipt as D5Receipt }; } };
  const sessions = new Map<string, ReturnType<typeof make>>();
  function make(saveId: string, contentVersion: number, epoch?: string) {
    const scoped: D5Store = !epoch ? bridge : {...bridge,
      async read(id) {const record=await bridge.read(id);if(record&&record.head.epoch!==epoch)throw Error("档案身份已变化，原任务已停止。");return record;},
      async commit(command) {if(command.epoch!==epoch)throw Error("档案身份已变化，拒绝写入原任务。");return bridge.commit(command);},
    };
    const host = createAirpGameHost(scoped, contentVersion === 28 ? ESTATE_AIRP_CATALOG : contentVersion === 26 ? FACILITIES_AIRP_CATALOG : contentVersion === 24 ? SHOP_AIRP_CATALOG : AIRP_GAME_CATALOG, saveId);
    const source = contentVersion === 28 ? householdLowR8Source : lowR8Source;
    const gm = createExpeditionGMService(host.gm), nodes = createNodeService(host.nodes), settlement = createSettlementService(host.settlement);
    return { host, gm, nodes, settlement, gmDriver: createExpeditionGMDriver(), nodeDriver: createNodeDriver(), settlementDriver: createSettlementDriver(),
      async prepare(departure: D5Departure) { await host.prepare(departure, source, undefined, tibbyAppraisalReference); return gm.enqueue(); },
      /** Pure bookkeeping recovery after real gameplay; NEVER calls a provider. */
      async sync() {
        const r = await host.initialize(source), plan = currentGamePlan(r);
        if (!plan) return;
        if (plan.status === "accepted" && r.snapshot.run?.kind === "expedition") await gm.recordStarted(plan.id);
        if (currentGamePlan(await host.read())?.status === "started") await nodes.sync();
      },
      async settle(nodeId: string) {
        const existing = (await settlement.read()).ledger.jobs.find(j => j.frames.at(-1)!.input.scope.boundaryId === nodeId);
        if (existing) return existing.id;
        const packet = await nodes.settlementInput(nodeId); return settlement.enqueue(packet.input, packet.materials);
      },
      async settleHome() {
        const r = await host.read(), b = pendingHomeBoundary(r);
        if (!b) throw Error("没有待整理的洋馆经历。");
        const existing = r.airpGame!.settlement.jobs.find(j => j.frames.at(-1)!.input.scope.boundaryId === b.factId);
        if (existing) return existing.id;
        const packet = homeSettlementPacket(r, b);
        return settlement.enqueue(packet.input, packet.materials);
      },
      async refreshHomeSettlement() {
        const r = await host.read(), b = pendingHomeBoundary(r);
        if (!b) throw Error("没有待整理的洋馆经历。");
        const packet = homeSettlementPacket(r, b), id = r.airpGame!.settlement.jobs.find(j => j.frames.at(-1)!.input.scope.boundaryId === b.factId)?.id ?? await settlement.enqueue(packet.input, packet.materials);
        await settlement.refresh(id, packet.input, packet.materials);
      },
      async useHomeProgramFacts() {
        const r = await host.read(), b = pendingHomeBoundary(r);
        if (!b) return;
        const packet = homeSettlementPacket(r, b), id = await settlement.enqueue(packet.input, packet.materials);
        await settlement.useProgramFacts(id); await settlement.apply(id);
      },
      async changeNodeConnection(nodeId: string, config: ModelConfiguration) {
        const j = (await nodes.read()).ledger.jobs.find(j => j.id === nodeId), stage = j && nodeStage(j);
        if (!stage) throw Error("请先结束或标记中断当前请求。");
        await nodes.changeConnection(nodeId, stage, lowHash(parseModel(config)));
      },
      async refreshSettlement(nodeId: string) {
        const packet = await nodes.settlementInput(nodeId), id = (await settlement.read()).ledger.jobs.find(j => j.frames.at(-1)!.input.scope.boundaryId === nodeId)?.id ?? await settlement.enqueue(packet.input, packet.materials);
        await settlement.refresh(id, packet.input, packet.materials);
      },
      async useProgramFacts(nodeId: string) {
        if ((await nodes.read()).ledger.jobs.find(j => j.id === nodeId)?.status === "completed") return;
        const packet = await nodes.settlementInput(nodeId), id = (await settlement.read()).ledger.jobs.find(j => j.frames.at(-1)!.input.scope.boundaryId === nodeId)?.id ?? await settlement.enqueue(packet.input, packet.materials);
        await settlement.useProgramFacts(id); await settlement.apply(id); await nodes.complete(nodeId);
      },
    };
  }
  return { forSave(saveId: string, contentVersion = 22, epoch?: string) { const key = JSON.stringify([saveId,contentVersion,epoch]); let s = sessions.get(key); if (!s) { s = make(saveId, contentVersion,epoch); sessions.set(key, s); } return s; } };
}
export function airpGameView(record: D5GameRecord) {
  if (!record.airpGame) return null;
  const plan = currentGamePlan(record);
  if (!plan || plan.status === "cancelled") return null;
  if (plan.status !== "started") return { plan, commissionRewards: gameCommissionRewards(plan) ?? [], node: null, stage: null, boundary: false };
  const s = projectGameNode(record, record.contentRef.contentVersion === 28 ? ESTATE_AIRP_CATALOG : record.contentRef.contentVersion === 26 ? FACILITIES_AIRP_CATALOG : record.contentRef.contentVersion === 24 ? SHOP_AIRP_CATALOG : AIRP_GAME_CATALOG, plan);
  const node = s.ledger.jobs.find(j => j.status === "open" && (!j.selected || nodeBoundaryReady(s, j))) ?? s.ledger.jobs.find(j => nodeGate(s, j) === "ready") ?? null;
  return { plan, commissionRewards: gameCommissionRewards(plan) ?? [], node, stage: node ? nodeStage(node) : null, boundary: !!node && nodeBoundaryReady(s, node) };
}
export { pendingHomeBoundary } from "../game-application/airp-game/home";
