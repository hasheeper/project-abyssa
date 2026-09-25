import { EXPEDITION_ENDINGS, sha256, emptyDirectorBudget, type ExpeditionPlanProposal } from "../../game-core/contracts";
import { expeditionPlanHash, expeditionTaskId } from "../../game-core/session";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { StoredRecord, StoredReceipt } from "../contracts";
import { createExpeditionGMHostPort } from "../airp-expedition-gm/host";
import { cloneExpedition, freezeExpeditionFrame } from "../airp-expedition-gm/context";
import { createExpeditionGMService, emptyExpeditionGMLedger } from "../airp-expedition-gm/service";
import type { ExpeditionContext, ExpeditionDocument, ExpeditionGMSnapshot } from "../airp-expedition-gm/contracts";

export function clcPacket(commission = false) {
  const head = { saveId: "cl-c-fixture", epoch: "epoch:1", revision: 10 }, departure = { runId: "run:1", routeId: "route:manor", partyIds: ["kael", "npc-a"], itemIds: ["food"], seed: 2026 };
  const context: ExpeditionContext = { rules: { protocol: 1, head, phase: 2, departure: { ...departure, commandHash: expeditionPlanHash(departure), intent: "按实际情况巡守，必要时撤离。" }, capabilityId: "test-capability:1",
    slots: [{ id: "slot:1", layer: 1, roomIndex: 0, roomDefinitionId: "room:1", timing: "cleared", actorIds: departure.partyIds, actionIds: ["continue"], objectiveIds: commission ? ["objective:medicine"] : [] }, { id: "slot:2", layer: 1, roomIndex: 1, roomDefinitionId: "exit:1", timing: "exit", actorIds: departure.partyIds, actionIds: ["continue", "leave"], objectiveIds: [] }],
    sourceIds: ["fact:current"], commissions: commission ? [{ eventId: "event:medicine", stepId: "patrol", definitionId: "medicine", title: "工作稿", objectiveId: "objective:medicine", slotId: "slot:1", actorIds: ["npc-a"], basisIds: ["fact:current"], returnRequired: true }] : [],
    schedule: { budget: emptyDirectorBudget(1), reservations: [], themes: [], existing: commission ? [{ id: "event:medicine", load: "focus", status: "accepted" }] : [], requiredStoryIds: [], busyFocus: false, uniqueCompletedIds: [] },
    fixedEvents: [], itemTemplates: [{ id: "test-template", digest: sha256("isolated-asset-template"), maxPerRun: 1, fields: [{ key: "name", label: "名称", maxLength: 40, values: null }] }], limits: { nodes: 4, events: 1, definitions: 1 } },
    playerName: "测试玩家", requiredActorIds: ["npc-a"], actors: [{ actorId: "npc-a", locationId: "hall", activity: null, conditions: [] }], affinity: [], tasks: [], sources: [{ id: "fact:current", kind: "program", phase: 2, knownBy: ["kael"], evidenceIds: ["fact:current"], text: "玩家确认本趟意图，但尚未出发。", digest: sha256("玩家确认本趟意图，但尚未出发。") }], memories: [], openThreads: [], receipts: [], pendingSettlementIds: [] };
  // Deliberately omit the internal seed from the public packet.
  delete (context.rules.departure as unknown as Record<string, unknown>).seed;
  const documents: ExpeditionDocument[] = [
    { id: "npc-a", kind: "character", text: "隔离测试完整卡。第一段。\n第二段保持原文。", digest: sha256("隔离测试完整卡。第一段。\n第二段保持原文。"), triggerIds: ["npc-a"] },
    { id: "world", kind: "world", text: "基础世界资料全文。", digest: sha256("基础世界资料全文。"), triggerIds: ["route:manor"] },
    { id: "player", kind: "player", text: "玩家原卡全文。", digest: sha256("玩家原卡全文。"), triggerIds: ["route:manor"] },
  ];
  return { context, documents, departure };
}
export function clcProposal(packet = clcPacket()): ExpeditionPlanProposal {
  const frame = freezeExpeditionFrame(packet.context, packet.documents, packet.departure), i = packet.context.rules, c = i.commissions[0], basisIds = [i.sourceIds[0]];
  const proposal: ExpeditionPlanProposal = { protocol: 1, taskId: expeditionTaskId(i), inputHash: frame.inputHash, focus: { kind: c ? "commission" : "exploration", id: c?.eventId ?? null, intent: "以真实过程承接本趟；不预定发现或成功。", basisIds },
    nodes: [{ id: "node:1", slotId: c?.slotId ?? i.slots[0].id, intent: "在实际到达并完成房间后，交出当前观察并等待玩家决定。", actorIds: [...i.departure.partyIds], basisIds, actionIds: [], prerequisites: [], link: c ? { kind: "commission", eventId: c.eventId, stepId: c.stepId, role: "objective" } : null, stop: "choice", itemKeys: [] }], events: [], itemDefinitions: [], endings: EXPEDITION_ENDINGS.map(outcome => ({ outcome, intent: "只按真实终局承接；保留未完成的交付义务。", basisIds, returnEventIds: i.commissions.map(c => c.eventId) })) };
  if (i.commissionRewardVersion === 1) {
    proposal.nodes = i.commissions.length ? i.commissions.map((c, index) => ({...proposal.nodes[0], id: `node:${index + 1}`, slotId: c.slotId, link: {kind: "commission", eventId: c.eventId, stepId: c.stepId, role: "objective"}, itemKeys: [`quest:${index}`]})) : proposal.nodes;
    proposal.itemDefinitions = i.commissions.map((c, index) => ({key: `quest:${index}`, templateId: c.itemTemplateId!, fields: {label: i.itemTemplates.find(t => t.id === c.itemTemplateId)!.fields.find(f => f.key === "label")!.values![0], description: "目标战斗胜利后取回的委托物品。", awardWhen: "room-cleared"}}));
  }
  if (i.appraisalPlanVersion === 1) proposal.appraisalItems = i.appraisalSlots!.map((s, index) => ({slotKey: s.key,
    unknownName: `封蜡的旧物${index + 1}`, appearance: "旧蜡封住了接缝，表面留着一排细小刻痕。",
    name: `旧航线记筹${index + 1}`, description: "从旧航线留下的记筹，用来核对货船的进港次序。",
    selectUnknown: {text: "先别刮那层蜡，我看看下面的刻痕。", emotion: "confused"},
    selectKnown: {text: "货早就卸完了，账倒还留在这里呢。", emotion: "wry"},
    appraisal: [{text: "旧航线的记筹，刻一道就是一条进港的船。", emotion: "confident"}, {text: "刻痕还清楚，这笔旧账倒是比你的好认。", emotion: "wry"}],
    sold: {text: "收下啦，这回总算轮到我付钱了呢。", emotion: "smile"}}));
  return proposal;
}
export function clcFreeProposal(packet = clcPacket()) {
  const p = clcProposal(packet), actorIds = packet.context.rules.departure.partyIds;
  p.events = [{ key: "aside", basisIds: p.focus.basisIds, source: { kind: "free", body: { title: "隔离小景", themeKey: "new-theme", themeDescription: "测试新的独立小景。", objectIds: [], actorIds, load: "light", needsReturn: false, repeat: "after-cooldown" } } }];
  p.nodes[0].link = { kind: "new-event", eventKey: "aside", step: "scene" }; return p;
}
type ClcRoot = StoredRecord & Omit<ExpeditionGMSnapshot, "head"> & { program: { location: string; supplies: number; rewardCount: number } };
/** Isolated root with the actual MemoryGameStore CAS; no Catalog registration or production save. */
export function clcHost(packet = clcPacket()) {
  const database = new MemoryGameDatabase<ClcRoot, StoredReceipt>(), storage = new MemoryGameStore(database);
  const initial: ClcRoot = { schemaVersion: 1, head: packet.context.rules.head, contentRef: { catalogId: "cl-c-fixture", contentVersion: 1, rulesVersion: 1, digest: "0".repeat(64) }, commits: [], ...cloneExpedition(packet), ledger: emptyExpeditionGMLedger(), activeRunId: null, startProofs: [], itemDefinitions: [], program: { location: "hall", supplies: 3, rewardCount: 0 } };
  database.records.set(initial.head.saveId, initial);
  let adapterReady = true, fail: { predicate: (r: ClcRoot) => boolean; after: boolean } | null = null;
  const store = { read: storage.read.bind(storage), receipt: storage.receipt.bind(storage), listSaveIds: storage.listSaveIds.bind(storage), async commit(p: Parameters<typeof storage.commit>[0]) {
    const matched = p.candidate && fail?.predicate(p.candidate), after = fail?.after;
    if (matched) { fail = null; if (!after) throw new Error("Storage failed before commit"); }
    const result = await storage.commit(p); if (matched && after) throw new Error("Lost successful commit response"); return result;
  } };
  const port = createExpeditionGMHostPort({ saveId: initial.head.saveId, store, validate(r) { if (r.contentRef.catalogId !== "cl-c-fixture") throw new Error("Foreign root"); },
    project: r => ({ context: r.context, documents: r.documents, departure: r.departure, ledger: r.ledger, activeRunId: r.activeRunId, startProofs: r.startProofs, itemDefinitions: r.itemDefinitions }),
    install(r, value) { return { ...r, head: value.head, ledger: value.ledger, commits: [...r.commits, { ref: value.head, previous: r.head, requestId: value.requestId, kind: "expedition-gm", factIds: [] }] }; },
    receipt: (r, { before, requestId, fingerprint }) => ({ version: 1, saveId: r.head.saveId, epoch: r.head.epoch, requestId, fingerprint, contentRef: r.contentRef, status: "committed", before, after: r.head, error: null, events: [], factIds: [] }),
    reservePlan(r, p) { if (!adapterReady) throw new Error("Asset adapter pending"); r.context.rules.schedule.reservations.push(...p.reservations); r.itemDefinitions.push(...p.itemDefinitions); return r; },
    releasePlan(r, p) { r.context.rules.schedule.reservations = r.context.rules.schedule.reservations.filter(x => x.ownerId !== p.id); r.itemDefinitions = r.itemDefinitions.filter(d => !p.itemDefinitions.some(x => x.id === d.id)); return r; },
  });
  return { database, store, port, service: createExpeditionGMService(port), packet,
    raw: () => cloneExpedition(database.records.get(initial.head.saveId)!),
    mutate(f: (r: ClcRoot) => void) { const r = cloneExpedition(database.records.get(initial.head.saveId)!); f(r); database.records.set(initial.head.saveId, r); },
    adapterReady(value: boolean) { adapterReady = value; },
    failOnce(predicate: (r: ClcRoot) => boolean, after = false) { fail = { predicate, after }; },
  };
}
