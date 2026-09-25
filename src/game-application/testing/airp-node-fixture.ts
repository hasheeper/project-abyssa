import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import type { ExpeditionPlanProposal } from "../../game-core/contracts";
import { airpPhaseIndex, expeditionPlanHash, D5_RUN_READERS } from "../../game-core/session";
import type { HeadRef, StoredRecord, StoredReceipt } from "../contracts";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import { validateD5Record } from "../versions/d5-validate";
import { expeditionGameplayCase } from "./airp-expedition-gm-gameplay-case";
import { clcProposal } from "./airp-expedition-gm-fixture";
import { createExpeditionGMHostPort } from "../airp-expedition-gm/host";
import { createExpeditionGMService, emptyExpeditionGMLedger } from "../airp-expedition-gm/service";
import { createSettlementHostPort } from "../airp-settlement/host";
import { createSettlementService, validateSettlementSnapshot } from "../airp-settlement/service";
import { createNodeHostPort } from "../airp-expedition-play/host";
import { assertNodeProgramMayAdvance, createNodeService, emptyNodeLedger, validateNodeSnapshot } from "../airp-expedition-play/service";
import { projectD5NodeProgram, type NodeProgramCommit } from "../airp-expedition-play/d5-source";
import { createD5NodeCalculator } from "../airp-expedition-play/d5-calculator";
import { projectD5DepartureProofs } from "../airp-expedition-gm/d5-source";
import { cloneLow, lowHash } from "../airp-low/native";
import { emptyUsage } from "../airp-generation/contracts";
import { readLowWriting } from "../airp-low/output";
import { nodeStage } from "../airp-expedition-play/service";
import { nodeWriting } from "../airp-expedition-play/context";
import { emptySettlementProposal } from "../airp-settlement/context";
import { sameHead } from "../transaction";

type Packet = Awaited<ReturnType<typeof expeditionGameplayCase>>["packet"];
type Root = StoredRecord & { kind: "cl-d-development-owner"; worldHead: HeadRef; gameplay: D5GameRecord; programCommits: NodeProgramCommit[];
  preparation: Packet; gm: ReturnType<typeof emptyExpeditionGMLedger>; nodes: ReturnType<typeof emptyNodeLedger>;
  settlement: Awaited<ReturnType<typeof expeditionGameplayCase>>["options"]["settlement"] };

/** Development aggregate, not the production reader: CL-C/D/B + actual D5 commands share ONE CAS. */
export async function nodeFixture(options: { commission?: boolean; proposal?: ExpeditionPlanProposal; start?: boolean } = {}) {
  const setup = await expeditionGameplayCase(options.commission ?? false), { packet } = setup;
  const database = new MemoryGameDatabase<Root, StoredReceipt>(), storage = new MemoryGameStore(database);
  const initial: Root = { schemaVersion: 1, kind: "cl-d-development-owner", contentRef: setup.options.record.contentRef, head: setup.options.record.head, worldHead: setup.options.record.head,
    commits: [], gameplay: setup.options.record, programCommits: [], preparation: packet, gm: emptyExpeditionGMLedger(), nodes: emptyNodeLedger(), settlement: setup.options.settlement };
  database.records.set(initial.head.saveId, cloneLow(initial));
  let failed: { predicate: (r: Root) => boolean; after: boolean } | null = null, previous: D5GameRecord | undefined;
  const store = { read: storage.read.bind(storage), receipt: storage.receipt.bind(storage), listSaveIds: storage.listSaveIds.bind(storage), async commit(p: Parameters<typeof storage.commit>[0]) {
    const match = p.candidate && failed?.predicate(p.candidate), after = failed?.after; if (match) { failed = null; if (!after) throw Error("Storage failure"); }
    const r = await storage.commit(p); if (match && after) throw Error("Lost committed response"); return r;
  } };
  const raw = () => cloneLow(database.records.get(initial.head.saveId)!);
  const proofs = (r: Root) => projectD5DepartureProofs(r.gameplay).map(p => ({ ...p, beforeHead: r.programCommits.find(c => c.factIds.includes(p.factId))!.before }));
  const program = (r: Root) => projectD5NodeProgram({ catalog: AIRP_DIRECTOR_CATALOG, record: r.gameplay, plan: r.gm.jobs[0], commits: r.programCommits });
  const nodeProjection = (r: Root) => ({ worldHead: r.worldHead, plan: r.gm.jobs[0], program: program(r), ledger: r.nodes, settlement: r.settlement, material: lowR8Source, grants: {} });
  const validate = (r: Root) => {
    if (r.kind !== "cl-d-development-owner" || r.schemaVersion !== 1 || !sameHead(r.worldHead, r.settlement.state.head)) throw Error("Invalid development owner");
    if (!previous || lowHash(previous) !== lowHash(r.gameplay)) previous = validateD5Record(r.gameplay, AIRP_DIRECTOR_CATALOG, D5_RUN_READERS, previous);
    for (const c of r.programCommits) if (!r.gameplay.commits.some(commit => sameHead(commit.ref, c.gameplayHead) && lowHash(commit.factIds) === lowHash(c.factIds)) || !r.commits.some((commit: any) => sameHead(commit.ref, c.head) && sameHead(commit.previous, c.before) && commit.kind === "real-d5")) throw Error("Invalid root/gameplay association");
    validateSettlementSnapshot({ head: r.head, worldHead: r.worldHead, ledger: r.settlement, appliedItemOperations: [] });
    if (r.gm.jobs[0]?.status === "started") validateNodeSnapshot({ head: r.head, ...nodeProjection(r) });
  };
  const advance = (r: Root, head: HeadRef, requestId: string, kind: string) => ({ ...r, head, commits: [...r.commits, { ref: head, previous: r.head, requestId, kind, factIds: [] }] });
  const receipt = (r: Root, { before, requestId, fingerprint }: { before: HeadRef; requestId: string; fingerprint: string }): StoredReceipt => ({ version: 1, saveId: r.head.saveId, epoch: r.head.epoch, requestId, fingerprint, contentRef: r.contentRef, status: "committed", before, after: r.head, error: null, events: [], factIds: [] });
  const common = { saveId: initial.head.saveId, store, validate, receipt };
  const gmPort = createExpeditionGMHostPort({ ...common,
    project: r => ({ context: r.preparation.context, documents: r.preparation.documents, departure: r.preparation.departure, ledger: r.gm, activeRunId: r.gameplay.snapshot.run?.id ?? null, startProofs: proofs(r), itemDefinitions: [] }),
    install: (r, c) => ({ ...advance(r, c.head, c.requestId, "gm"), gm: c.ledger }),
  });
  const settlementPort = createSettlementHostPort({ ...common,
    project: r => ({ worldHead: r.worldHead, ledger: r.settlement, appliedItemOperations: [] }),
    install: (r, c) => ({ ...advance(r, c.head, c.requestId, "settlement"), worldHead: c.worldHead, settlement: c.ledger }),
  });
  const nodePort = createNodeHostPort({ ...common, project: nodeProjection,
    install: (r, c) => { const value = advance(r, c.head, c.requestId, "node"); value.worldHead = c.worldHead; value.settlement.state.head = c.worldHead; value.nodes = c.ledger; return value; },
  });
  const gm = createExpeditionGMService(gmPort), settlement = createSettlementService(settlementPort), nodes = createNodeService(nodePort);
  const planId = await gm.enqueue(), proposal = options.proposal ?? clcProposal(packet);
  if (!options.proposal) {
    const basis = proposal.focus.basisIds;
    proposal.nodes = [
      { id: "entry", slotId: "slot:1:0:arrive", intent: "队伍已到维护路线入口。艾洛拉确认是否准备好向前走，等待玩家表态；还没有战斗或发现。", actorIds: ["kael", "elora"], basisIds: basis, actionIds: [], prerequisites: [], link: null, stop: "scene-end", itemKeys: [] },
      { id: "first-cleared", slotId: "slot:1:0:cleared", intent: "第一处战斗刚结束，艾洛拉接住玩家在入口的态度，问是否继续。只承接已确认状态，不描写下一房间或新收获。", actorIds: ["kael", "elora"], basisIds: basis, actionIds: ["continue"], prerequisites: [{ nodeId: "entry", outcome: "completed" }], link: null, stop: "program", itemKeys: [] },
      { id: "exit", slotId: "slot:3:1:exit", intent: "已经抵达出口，等待真实撤离或继续，不预定选择。", actorIds: ["kael", "elora"], basisIds: basis, actionIds: ["leave", "continue"], prerequisites: [{ nodeId: "first-cleared", outcome: "completed" }], link: null, stop: "program", itemKeys: [] },
      { id: "deep", slotId: "slot:5:0:cleared", intent: "仅在真实到达并完成后承接深层状况。", actorIds: ["kael", "elora"], basisIds: basis, actionIds: [], prerequisites: [{ nodeId: "exit", outcome: "completed" }], link: null, stop: "scene-end", itemKeys: [] },
    ];
    const commission = packet.context.rules.commissions[0];
    if (commission) {
      // A commissioned fixture must cover its actual objective, just like a real GM.
      const objective = proposal.nodes[1]; objective.slotId = commission.slotId;
      objective.link = { kind: "commission", eventId: commission.eventId, stepId: commission.stepId, role: "objective" };
      objective.intent = "实际完成委托目标房间后，承接程序目标证据，不冒称已经回馆交付。";
    }
  }
  await gm.begin(planId, { id: "plan-fixture", stage: "plan", model: "mock-GM", connectionHash: "1".repeat(64), at: 1 });
  await gm.result(planId, "plan-fixture", JSON.stringify(proposal), emptyUsage(), 2); await gm.accept(planId);
  const compute = createD5NodeCalculator(AIRP_DIRECTOR_CATALOG);
  const send = async (command: D5Command, requestId = `play:${raw().head.revision}`, expectedHead = raw().head) => {
    const before = raw(), fingerprint = lowHash({ command, expectedHead }), prior = await store.receipt(before.head.saveId, before.head.epoch, requestId);
    if (prior) { if (prior.fingerprint !== fingerprint) throw Error("Request identity reused"); return raw(); }
    if (!sameHead(before.head, expectedHead)) throw Error("Gameplay CAS conflict");
    if (command.type === "start-expedition") {
      const ticket = before.gm.jobs[0].departureTicket;
      const { type: _type, ...departure } = command;
      if (!ticket || !sameHead(ticket.expectedHead, before.head) || ticket.commandHash !== expeditionPlanHash(departure)) throw Error("No current departure permit");
    } else { if (before.gm.jobs[0].status !== "started") throw Error("Plan not started"); assertNodeProgramMayAdvance({ head: before.head, ...nodeProjection(before) }); }
    const computed = await compute(before.gameplay, command, requestId);
    const head = { ...before.head, revision: before.head.revision + 1 }, next = advance(before, head, requestId, "real-d5");
    next.gameplay = computed.record; next.worldHead = head; next.settlement.state.head = head; next.settlement.state.phase = airpPhaseIndex(computed.record.snapshot.campaign.clock.day, computed.record.snapshot.campaign.clock.phase);
    next.programCommits.push({ head, before: before.head, factIds: computed.receipt.factIds, gameplayHead: computed.record.head }); validate(next);
    const result = await store.commit({ saveId: head.saveId, epoch: head.epoch, expectedHead, requestId, fingerprint, candidate: next, receipt: receipt(next, { before: before.head, requestId, fingerprint }) });
    if (result.receipt.status !== "committed") throw Error("Gameplay CAS rejected"); return raw();
  };
  if (options.start !== false) { const permit = await gm.departurePermit(planId); await send({ type: "start-expedition", ...permit.departure }, "start-node-run", permit.expectedHead); await gm.recordStarted(planId); await nodes.sync(); }
  return { database, store, raw, gm, nodes, nodePort, settlement, settlementPort, send, setup, planId, validate,
    failOnce(predicate: (r: Root) => boolean, after = false) { failed = { predicate, after }; },
    restore(r: Root) { validate(r); database.records.set(r.head.saveId, cloneLow(r)); },
  };
}

export const mockNodeWriting = (line = "门就在前面，要走了吗？") => `<planning>测试用公开创作占位，不是正文。</planning><Interleaving><thinking>测试占位一。</thinking>\n入口的门半开着。\n\n艾洛拉[serious]：「行こうか？（${line}）」\n<thinking>测试占位二。</thinking>\n她把手从门上收回来。\n<thinking>测试占位三。</thinking>\n艾洛拉[smile]：「待っているよ。（我等你。）」\n\n【可选回应】\n1. 谨慎确认情况\n2. 坦然面对未知\n3. 暂时保留意见\n</Interleaving>`;
export async function mockNodeText(f: Awaited<ReturnType<typeof nodeFixture>>, id: string, writing = mockNodeWriting()) {
  await f.nodes.open(id);
  for (const stage of ["writing", "formatting"] as const) {
    const j = (await f.nodes.read()).ledger.jobs.find(j => j.id === id)!;
    if (nodeStage(j) !== stage) continue;
    const attemptId = `${stage}:${j.attempts.length}`;
    await f.nodes.begin(id, { id: attemptId, stage, model: "mock", connectionHash: "2".repeat(64), at: 3 });
    const output = stage === "writing" ? writing : JSON.stringify(readLowWriting(nodeWriting(j), j.frame!).text);
    await f.nodes.result(id, attemptId, output, emptyUsage(), 4);
  }
}
export async function readAndChooseNode(f: Awaited<ReturnType<typeof nodeFixture>>, id: string) {
  const j = (await f.nodes.read()).ledger.jobs.find(j => j.id === id)!;
  for (let i = j.reads.length; i < j.text!.lines.length; i++) await f.nodes.readLine(id, i);
  await f.nodes.choose(id, 0);
}
export async function mockNodeSettlement(f: Awaited<ReturnType<typeof nodeFixture>>, id: string) {
  const packet = await f.nodes.settlementInput(id), task = await f.settlement.enqueue(packet.input, packet.materials);
  await f.settlement.begin(task, { id: `settlement:${id}`, model: "mock", connectionHash: "3".repeat(64), at: 5 });
  await f.settlement.result({ jobId: task, attemptId: `settlement:${id}`, output: JSON.stringify(emptySettlementProposal(packet.input)), usage: emptyUsage(), at: 6 });
  await f.settlement.apply(task); await f.nodes.complete(id); return task;
}
