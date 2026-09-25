import type { AcceptedExpeditionPlan } from "../../game-core/contracts";
import { expeditionPlanHash } from "../../game-core/session";
import type { GameStorePort, HeadRef, StoredReceipt, StoredRecord } from "../contracts";
import { sameHead } from "../transaction";
import { cloneExpedition, expeditionWorldFingerprint } from "./context";
import { ExpeditionGMError, type ExpeditionGMHostPort, type ExpeditionGMLedger, type ExpeditionGMSnapshot } from "./contracts";
import { validateExpeditionGMSnapshot } from "./service";

/** New version owning aggregate adapter. Does not modify any old reader or create a sidecar wallet. */
export function createExpeditionGMHostPort<R extends StoredRecord, C extends StoredReceipt>(options: {
  saveId: string; store: GameStorePort<R, C>; validate(record: R): void;
  project(record: R): Omit<ExpeditionGMSnapshot, "head">;
  install(record: R, value: { head: HeadRef; ledger: ExpeditionGMLedger; requestId: string }): R;
  receipt(record: R, value: { before: HeadRef; requestId: string; fingerprint: string }): C;
  /** Synchronous candidate-only updates to the SAME shared scheduler / asset-definition store. */
  reservePlan?: (record: R, plan: AcceptedExpeditionPlan) => R;
  releasePlan?: (record: R, plan: AcceptedExpeditionPlan) => R;
}): ExpeditionGMHostPort {
  const root = async () => { const r = await options.store.read(options.saveId); if (!r) throw new ExpeditionGMError("invalid", "Owning save missing"); options.validate(r); return r; };
  const project = (r: R) => { const s = { head: r.head, ...options.project(r) }; validateExpeditionGMSnapshot(s); return cloneExpedition(s); };
  return {
    async read() { return project(await root()); },
    async commit(command) {
      const record = await root(); if (!sameHead(record.head, command.expectedHead)) throw new ExpeditionGMError("conflict", "Owning root changed");
      let candidate = cloneExpedition(record);
      const change = command.change;
      const before = options.project(record);
      if (change && (change.plan.events.length || change.plan.itemDefinitions.length)) {
        const adapter = change.kind === "accept" ? options.reservePlan : options.releasePlan;
        if (!adapter) throw new ExpeditionGMError("adapter-pending", "Shared scheduler/asset-definition adapter is not installed; nothing adopted");
        candidate = adapter(candidate, cloneExpedition(change.plan));
        const s = options.project(candidate), has = (a: unknown, b: unknown) => expeditionPlanHash(a) === expeditionPlanHash(b);
        if (change.kind === "accept") {
          if (change.plan.reservations.some(r => !s.context.rules.schedule.reservations.some(saved => has(saved, r))) || change.plan.itemDefinitions.some(d => !s.itemDefinitions.some(saved => has(saved, d)))) throw new ExpeditionGMError("adapter-pending", "Reservation adapter did not freeze every exact entry/definition");
        } else if (s.context.rules.schedule.reservations.some(r => r.ownerId === change.plan.id)) throw new ExpeditionGMError("adapter-pending", "Own unpublished reservations were not released");
      }
      const fingerprint = expeditionPlanHash(command), requestId = `expedition-gm:${fingerprint}`, head = { ...record.head, revision: record.head.revision + 1 };
      candidate = options.install(candidate, { head, ledger: cloneExpedition(command.next), requestId }); options.validate(candidate);
      const installed = project(candidate);
      if (!sameHead(installed.head, head) || expeditionPlanHash(installed.ledger) !== expeditionPlanHash(command.next)) throw new ExpeditionGMError("invalid", "Installer altered the immutable plan transaction");
      const equal = (a: unknown, b: unknown) => expeditionPlanHash(a) === expeditionPlanHash(b);
      if (expeditionWorldFingerprint(before.context, before.documents) !== expeditionWorldFingerprint(installed.context, installed.documents) || !equal(before.departure, installed.departure) || before.activeRunId !== installed.activeRunId || !equal(before.startProofs, installed.startProofs)) throw new ExpeditionGMError("invalid", "Planning transaction cannot change gameplay or departure facts");
      const omitOwned = (s: ExpeditionGMSnapshot["context"]["rules"]["schedule"]) => ({ ...s, reservations: s.reservations.filter(r => r.ownerId !== change?.plan.id), themes: s.themes.filter(t => !change?.plan.events.some(e => e.id === t.sourceId)) });
      if (!equal(omitOwned(before.context.rules.schedule), omitOwned(installed.context.rules.schedule))) throw new ExpeditionGMError("invalid", "Planning transaction changed foreign reservations or the published day ledger");
      const foreignItems = (items: ExpeditionGMSnapshot["itemDefinitions"]) => items.filter(d => !change?.plan.itemDefinitions.some(p => p.id === d.id));
      if (!equal(foreignItems(before.itemDefinitions), foreignItems(installed.itemDefinitions))) throw new ExpeditionGMError("invalid", "Planning transaction changed unrelated asset definitions");
      const receipt = options.receipt(candidate, { before: record.head, requestId, fingerprint });
      const result = await options.store.commit({ saveId: head.saveId, epoch: head.epoch, requestId, fingerprint, expectedHead: record.head, candidate, receipt });
      if (result.receipt.status !== "committed") throw new ExpeditionGMError("conflict", "Atomic root CAS rejected; no reservations adopted");
      return project(await root());
    },
  };
}
