import type { GameStorePort, HeadRef, StoredRecord, StoredReceipt } from "../contracts";
import { sameHead } from "../transaction";
import { check } from "../airp-generation/contracts";
import { cloneLow, lowHash } from "../airp-low/native";
import type { NodeCommit, NodeHostPort, NodeLedger, NodeSnapshot } from "./contracts";
import { validateNodeSnapshot } from "./service";

/** Shared owning-root CAS. No sidecar save, asset writer or implicit gameplay action. */
export function createNodeHostPort<R extends StoredRecord, C extends StoredReceipt>(options: {
  saveId: string; store: GameStorePort<R, C>; validate(r: R): void;
  project(r: R): Omit<NodeSnapshot, "head">;
  install(r: R, change: { head: HeadRef; worldHead: HeadRef; ledger: NodeLedger; requestId: string; kind: NodeCommit["kind"] }): R;
  receipt(r: R, change: { before: HeadRef; requestId: string; fingerprint: string }): C;
}): NodeHostPort {
  const root = async () => { const r = await options.store.read(options.saveId); check(r, "Owning archive missing"); options.validate(r); return r; };
  const project = (r: R) => { const s = { head: r.head, ...options.project(r) }; validateNodeSnapshot(s); return cloneLow(s); };
  return {
    async read() { return project(await root()); },
    async commit(command) {
      const r = await root(), before = project(r); check(sameHead(r.head, command.expectedHead) && sameHead(before.worldHead, command.expectedWorldHead), "Node root CAS conflict");
      const head = { ...r.head, revision: r.head.revision + 1 }, worldHead = command.kind === "observation" ? head : before.worldHead, fingerprint = lowHash(command), requestId = `cl-d:${fingerprint}`;
      const candidate = options.install(cloneLow(r), { head, worldHead, ledger: cloneLow(command.next), kind: command.kind, requestId }); options.validate(candidate);
      const installed = project(candidate);
      check(sameHead(installed.head, head) && sameHead(installed.worldHead, worldHead) && lowHash(installed.ledger) === lowHash(command.next), "Node installer changed transaction");
      const expectedSettlement = cloneLow(before.settlement); expectedSettlement.state.head = worldHead;
      check(lowHash(installed.settlement) === lowHash(expectedSettlement) && lowHash(installed.program) === lowHash(before.program) && lowHash(installed.plan) === lowHash(before.plan) && lowHash(installed.material) === lowHash(before.material) && lowHash(installed.grants) === lowHash(before.grants), "Reading/generation cannot mutate gameplay, plan, materials or settlement effects");
      const receipt = options.receipt(candidate, { before: r.head, requestId, fingerprint });
      const result = await options.store.commit({ saveId: head.saveId, epoch: head.epoch, requestId, fingerprint, expectedHead: r.head, candidate, receipt });
      check(result.receipt.status === "committed", "Node CAS rejected; nothing applied"); return project(await root());
    },
  };
}
