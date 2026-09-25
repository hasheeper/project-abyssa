import type { SettlementInput, SettlementItemRef, SettlementProposal } from "../../game-core/contracts";
import { sha256 } from "../../game-core/contracts";
import { settlementFixture } from "../../game-core/session/testing/airp-settlement-fixture";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { GameCommit, HeadRef, StoredReceipt, StoredRecord } from "../contracts";
import { createSettlementHostPort } from "../airp-settlement/host";
import type { SettlementLedger, SettlementMaterials } from "../airp-settlement/contracts";
import { createSettlementLedger, createSettlementService } from "../airp-settlement/service";
import { cloneSettlement, emptySettlementProposal, settlementHash } from "../airp-settlement/context";

export const CLB_CARD = "隔离测试完整卡：NPC-A谨慎，不以请求是否被接受作为好恶标准。她重视玩家是否如实说明，知道的事情限于当面见闻。\n原文第二段不允许摘要替代。";
export function clbInput() {
  const input = settlementFixture();
  input.fullActorCards = [{ actorId: "npc-a", digest: sha256(CLB_CARD) }];
  const read = input.evidence[1]; if (read.kind === "read-paragraph") read.archive.digest = sha256("她把纸条放回桌上。");
  const materials: SettlementMaterials = { cards: [{ actorId: "npc-a", text: CLB_CARD, digest: sha256(CLB_CARD) }], evidence: [
    { sourceId: "fact:choice", text: "玩家已如实说明情况，并完成本步骤；不代表承诺下一项行动。", digest: sha256("玩家已如实说明情况，并完成本步骤；不代表承诺下一项行动。") },
    { sourceId: "read:1", text: "她把纸条放回桌上。", digest: sha256("她把纸条放回桌上。") },
  ], world: [{ id: "world:test", text: "测试设定全文。", digest: sha256("测试设定全文。"), triggerIds: ["npc-a"] }] };
  return { input, materials };
}
export function clbProposal(input: SettlementInput, items = false): SettlementProposal {
  const p = emptySettlementProposal(input);
  p.affinity = [{ grantId: "grant:affinity", gradeId: "up", reason: "重视如实说明，而非接受请求本身。", basisIds: ["fact:choice"] }];
  p.actors = [{ grantId: "grant:actor", locationId: "garden", basisIds: ["fact:choice"] }];
  if (items) p.items = [{ grantId: "grant:item", basisIds: ["fact:choice"] }];
  p.memory.points = [{ kind: "fact", text: "本步骤实际结果已确认，相关变化按回执记录。", speakerId: null, knownBy: ["player", "npc-a"], basisIds: ["fact:choice"] }];
  return p;
}
/** Fixture root only: not a shipping Catalog or a second game inventory. */
export type ClbHostRecord = StoredRecord & {
  worldHead: HeadRef; ledger: SettlementLedger; itemOperations: SettlementItemRef[]; itemCount: number;
  committedProgramText: string;
};
export function clbHost(input = clbInput().input) {
  const database = new MemoryGameDatabase<ClbHostRecord, StoredReceipt>(), storage = new MemoryGameStore(database);
  const ref = { catalogId: "cl-b-isolated-fixture", contentVersion: 1, rulesVersion: 1, digest: "0".repeat(64) };
  const initial: ClbHostRecord = { schemaVersion: 1, head: input.state.head, worldHead: input.state.head, contentRef: ref,
    commits: [], ledger: createSettlementLedger(input.policy, input.state), itemOperations: [], itemCount: 0, committedProgramText: "The real program action has already committed." };
  database.records.set(initial.head.saveId, cloneSettlement(initial));
  let assetReady = true, fail: { predicate: (r: ClbHostRecord) => boolean; after: boolean } | null = null;
  const store = {
    read: storage.read.bind(storage), listSaveIds: storage.listSaveIds.bind(storage), receipt: storage.receipt.bind(storage),
    async commit(p: Parameters<typeof storage.commit>[0]) {
      const match = p.candidate && fail?.predicate(p.candidate), after = fail?.after;
      if (match) { fail = null; if (!after) throw new Error("Simulated storage failure before atomic commit"); }
      const result = await storage.commit(p);
      if (match && after) throw new Error("Simulated lost commit acknowledgement");
      return result;
    },
  };
  const port = createSettlementHostPort({ saveId: initial.head.saveId, store,
    validate(r) { if (r.contentRef.catalogId !== ref.catalogId) throw new Error("Foreign fixture root"); },
    project: r => ({ worldHead: r.worldHead, ledger: r.ledger, appliedItemOperations: r.itemOperations }),
    install(r, value) {
      const commit: GameCommit = { ref: value.head, previous: r.head, requestId: value.requestId, kind: `cl-b-${value.kind}`, factIds: [] };
      return { ...r, head: value.head, worldHead: value.worldHead, ledger: value.ledger, commits: [...r.commits, commit] };
    },
    receipt: (r, { before, requestId, fingerprint }) => ({ version: 1, saveId: r.head.saveId, epoch: r.head.epoch, requestId, fingerprint, contentRef: r.contentRef, status: "committed", before, after: r.head, error: null, events: [], factIds: [] }),
    applyItems(r, operations) {
      if (!assetReady) throw new Error("Asset implementation still under construction");
      const authorized = input.grants.flatMap(g => g.kind === "item" ? [g.operation] : []);
      for (const operation of operations) {
        if (!authorized.some(a => settlementHash(a) === settlementHash(operation)) || r.itemOperations.some(a => a.operationId === operation.operationId)) throw new Error("Unknown or already-applied asset operation");
        r.itemOperations.push(operation); r.itemCount++;
      }
      return r;
    },
  });
  const service = createSettlementService(port);
  return { database, store, port, service, input,
    assetsReady(value: boolean) { assetReady = value; },
    failOnce(predicate: (r: ClbHostRecord) => boolean, after = false) { fail = { predicate, after }; },
    raw() { return cloneSettlement(database.records.get(initial.head.saveId)!); },
    advanceWorld() {
      const r = cloneSettlement(database.records.get(initial.head.saveId)!); r.head.revision++; r.worldHead = cloneSettlement(r.head); r.ledger.state.head = cloneSettlement(r.head); r.ledger.state.phase++;
      database.records.set(initial.head.saveId, r);
    },
  };
}
