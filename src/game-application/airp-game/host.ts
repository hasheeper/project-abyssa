import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { airpPhaseIndex, createD5ExpeditionEngine, type D5Departure } from "../../game-core/session";
import type { HeadRef } from "../contracts";
import type { D5GameRecord, D5Receipt, D5Store } from "../versions/d5-contracts";
import { d5FactId, validateD5Record, validateD5Receipt } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import { sameHead } from "../transaction";
import { createSettlementLedger } from "../airp-settlement/service";
import type { SettlementHostPort } from "../airp-settlement/contracts";
import type { ExpeditionDocument, ExpeditionGMHostPort } from "../airp-expedition-gm/contracts";
import type { NodeHostPort } from "../airp-expedition-play/contracts";
import type { LowMaterial } from "../airp-low/contracts";
import { airpGameHash, currentGamePlan, gameClone, gameHash, projectGameGm, projectGameNode, rebaseAirpGame } from "./projection";
import type { AirpGameProof, AirpGameState } from "./contracts";
import { shareSettlement } from "../airp-settlement/share";
import { gameSettlementPolicy } from "./policy";
import { pendingHomeBoundary } from "./home";
import { projectGMShare, readGMShare, sameGMShareContent } from "./gm-share";
import { recordMemoryContext } from "../airp-memory/d5";
import { createD5Application } from "../versions/d5-service";

/** Formal D5 owning-save adapters. No second gameplay root, wallet or drop implementation. */
export function createAirpGameHost(store: D5Store, catalog: ValidatedD5Catalog, saveId: string) {
  let cached: D5GameRecord | undefined, cachedJson: string | undefined;
  async function read() {
    const raw = await store.read(saveId);
    if (!raw || ![22, 24, 26, 28].includes(raw.contentRef.contentVersion)) throw Error("请选择新的 AIRP 游戏档；旧档不会自动升级。");
    const json = JSON.stringify(raw);
    if (cached && json === cachedJson) return cached;
    cached = validateD5Record(raw, catalog, D5_RUN_READERS, cached); cachedJson = JSON.stringify(cached); return cached;
  }
  async function registerCommissions() {
    const r = await read();
    if (!r.airpDirector || r.airpDirector.commissionVersion === 1) return r;
    if (r.snapshot.run) throw Error("请先结束当前远征，再更新委托登记。");
    const result = await createD5Application(catalog, store).dispatch({protocolVersion: 4, saveId, expectedHead: r.head,
      clientRequestId: `commission-registration:${r.head.epoch}:${r.head.revision}`, command: {type: "airp-director-enable-commissions"}});
    if (!result.ok) throw Error(result.error.message);
    return read();
  }
  async function commit(expected: HeadRef, kind: AirpGameProof["kind"], world: boolean, edit: (r: D5GameRecord) => void) {
    const before = await read();
    if (!sameHead(before.head, expected)) throw Error("存档已改变，请重新读取后继续。");
    const next = gameClone(before); next.head = { ...before.head, revision: before.head.revision + 1 };
    edit(next); if (world) rebaseAirpGame(next);
    const proof: AirpGameProof = { version: 1, kind, world, stateHash: airpGameHash(next.airpGame!) };
    const previousShare = readGMShare(before.facts, before.retractedFactIds);
    // Once opted in, keep the read-only history complete even if later jobs use an older context.
    if ((next.airpDirector?.lowContextVersion ?? 0) >= 17 || previousShare) {
      const share = projectGMShare(next);
      if (!previousShare || !sameGMShareContent(previousShare, share)) proof.gmShare = share;
    }
    if (kind === "settlement" && world && next.airpGame!.settlement.receipts.length > before.airpGame!.settlement.receipts.length) proof.settlement = shareSettlement(next.airpGame!.settlement, next.airpGame!.settlement.receipts.at(-1)!.taskId);
    const fingerprint = gameHash({ expected, proof }), requestId = `airp-game:${fingerprint}`, factId = d5FactId(saveId, next.head.epoch, next.head.revision, 0);
    next.facts.push({ version: 4, id: factId, source: next.head, origin: "present", runRef: null, originRef: null, worldTime: before.snapshot.campaign.clock, visibility: "party", kind: "airp-game", payload: proof });
    next.commits.push({ ref: next.head, previous: before.head, requestId, kind: "airp-game", factIds: [factId] });
    const receipt: D5Receipt = { version: 4, contentRef: catalog.ref, saveId, epoch: next.head.epoch, requestId, fingerprint, status: "committed", before: before.head, after: next.head, error: null, events: [], factIds: [factId], airpGame: proof };
    const candidate = validateD5Record(next, catalog, D5_RUN_READERS, before);
    const result = await store.commit({ saveId, epoch: next.head.epoch, expectedHead: before.head, requestId, fingerprint, candidate, receipt: validateD5Receipt(receipt, catalog) });
    if (result.receipt.status !== "committed") throw Error("存档提交冲突，请重新读取。");
    cached = candidate; cachedJson = JSON.stringify(candidate); return read();
  }
  const settlementSnapshot = (r: D5GameRecord) => {
    const memoryView = recordMemoryContext(r);
    return { head: r.head, worldHead: r.airpGame!.worldHead, ledger: r.airpGame!.settlement, appliedItemOperations: [], ...(memoryView ? {memoryView} : {}) };
  };
  const gm: ExpeditionGMHostPort = {
    async read(options) { return projectGameGm(await read(), catalog, options?.refresh); },
    async commit(c) {
      if (c.change?.plan.events.length) throw Error("本批只关联已有委托，不发布GM新卡。");
      const r = await commit(c.expectedHead, "gm", false, r => { r.airpGame!.gm = gameClone(c.next); }); return projectGameGm(r, catalog);
    },
  };
  const nodes: NodeHostPort = {
    async read() { return projectGameNode(await read(), catalog); },
    async commit(c) {
      const r = await commit(c.expectedHead, "node", c.kind === "observation", r => {
        if (!sameHead(r.airpGame!.worldHead, c.expectedWorldHead)) throw Error("场景状态已改变。");
        r.airpGame!.nodes[currentGamePlan(r)!.id] = gameClone(c.next);
      }); return projectGameNode(r, catalog);
    },
  };
  const settlement: SettlementHostPort = {
    async read() { return settlementSnapshot(await read()); },
    async commit(c) {
      // Actual drops already belong to the D5 engine, including appraisal/sales receipts.
      if (c.effects.some(e => e.kind === "item")) throw Error("不能通过叙事结算重复发放程序掉落。");
      const r = await commit(c.expectedHead, "settlement", c.kind === "settlement", r => {
        if (!sameHead(r.airpGame!.worldHead, c.expectedWorldHead)) throw Error("结算输入已经过期。");
        r.airpGame!.settlement = gameClone(c.next);
      }); return settlementSnapshot(r);
    },
  };
  async function initialize(material: LowMaterial) {
      const r = await read();
      const policy = gameSettlementPolicy(catalog, r.airpDirector?.residentCast);
      if (r.airpGame) {
        const old = r.airpGame;
        if (!r.airpDirector?.residentCast || policy.actorIds.every(id => old.settlement.policy.actorIds.includes(id)) && material.sources.every(s => old.material.sources.some(d => d.id === s.id && d.sha256 === s.sha256))) return r;
        // A new material/policy applies to future frames only, after in-flight work finishes.
        if (r.snapshot.run || old.settlement.jobs.some(j => j.status !== "applied") || Object.values(old.nodes).some(n => n.jobs.some(j => j.status === "open")) || old.gm.jobs.some(j => !["cancelled", "started"].includes(j.status))) return r;
        return commit(r.head, "prepare", false, n => {
          n.airpGame!.material = gameClone(material);
          n.airpGame!.settlement.policy = policy;
          n.airpGame!.settlement.state.policyId = policy.id;
        });
      }
      return commit(r.head, "prepare", false, n => { n.airpGame = { version: 1, worldHead: gameClone(r.head), material: gameClone(material), preparation: null, gm: { version: 1, jobs: [] }, nodes: {},
        settlement: createSettlementLedger(policy, { protocol: 1, policyId: policy.id, head: r.head, phase: airpPhaseIndex(r.snapshot.campaign.clock.day, r.snapshot.campaign.clock.phase), actors: [], affinity: [] }) }; });
  }
  return { read, gm, nodes, settlement, registerCommissions, initialize,
    async prepare(departure: D5Departure, material: LowMaterial, intent = "沿选定路线探索，承接当前队伍与已经接受的委托。", appraiser?: Omit<ExpeditionDocument, "triggerIds">) {
      let r = await read(); if (r.snapshot.run || r.airpDirector?.reading && !r.airpDirector.reading.paused) throw Error("请先结束当前远征或交谈。");
      if (pendingHomeBoundary(r)) throw Error("请先整理本次反馈或选择仅记程序事实。");
      createD5ExpeditionEngine(catalog).create(gameClone(r.snapshot.campaign), gameClone(departure));
      r = await registerCommissions();
      if (r.airpGame && r.airpDirector?.residentCast) r = await initialize(material);
      const old = r.airpGame, active = old?.gm.jobs.find(j => !["cancelled", "started"].includes(j.status));
      if (active) {
        if (gameHash(old!.preparation?.departure) === gameHash(departure)) return r;
        throw Error("请先取消或继续已保存的出征安排。");
      }
      if (old?.settlement.jobs.some(j => j.status !== "applied") || Object.values(old?.nodes ?? {}).some(n => n.jobs.some(j => j.status === "open"))) throw Error("请先完成上一场的阅读与结算。");
      const actorIds = [...departure.partyIds, ...(r.airpDirector?.events.filter(e => ["accepted", "waiting-action", "feedback", "ready"].includes(e.status)).flatMap(e => e.card.actorIds) ?? [])];
      const documents = material.sources.filter(s => s.kind !== "character" || actorIds.includes(s.id)).map(s => ({ id: s.id, kind: s.kind === "character" ? "character" as const : s.kind === "player" ? "player" as const : "world" as const, text: s.text, digest: s.sha256, triggerIds: [departure.routeId] }));
      if (appraiser) {
        if (appraiser.id !== "tibby" || appraiser.kind !== "character") throw Error("鉴定物规划需要缇比完整角色卡。");
        if (!documents.some(d => d.id === appraiser.id)) documents.push({...appraiser, kind: "character", triggerIds: [departure.routeId]});
      }
      const policy = gameSettlementPolicy(catalog, r.airpDirector?.residentCast);
      const initial: AirpGameState = old ? gameClone(old) : { version: 1, worldHead: gameClone(r.head), material: gameClone(material), preparation: { departure, intent, documents }, gm: { version: 1, jobs: [] }, nodes: {},
        settlement: createSettlementLedger(policy, { protocol: 1, policyId: policy.id, head: r.head, phase: airpPhaseIndex(r.snapshot.campaign.clock.day, r.snapshot.campaign.clock.phase), actors: [], affinity: [] }) };
      initial.preparation = { ...(appraiser ? {appraisalPlanVersion: 1 as const} : {}), commissionRewardVersion: 1, departure: gameClone(departure), intent, documents };
      // Only at a fresh departure with no unfinished old nodes; frozen old inputs stay intact.
      if (initial.settlement.policy.id === "airp-game-memory-1") {
        initial.settlement.policy = policy; initial.settlement.state.policyId = policy.id;
      }
      // Validate route, equipment, complete cards and source projection before persistence.
      projectGameGm({ ...r, airpGame: initial }, catalog);
      return commit(r.head, "prepare", false, n => { n.airpGame = initial; });
    },
  };
}
