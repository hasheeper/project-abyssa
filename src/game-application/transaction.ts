import { canonicalJson } from "../game-core/contracts";
import type {
  CommandReceipt,
  CommitProposal,
  CommitResult,
  GameRecord,
  HeadRef,
  ReceiptError,
  CatalogRef,
  StoredRecord,
  StoredReceipt,
} from "./contracts";

export const sameHead = (a: HeadRef | null, b: HeadRef | null): boolean =>
  a === null || b === null
    ? a === b
    : a.saveId === b.saveId && a.epoch === b.epoch && a.revision === b.revision;
export const headKey = (head: HeadRef): string =>
  `${head.saveId}/${head.epoch}/${head.revision}`;
export const requestKey = (
  saveId: string,
  epoch: string,
  requestId: string,
): string => canonicalJson([saveId, epoch, requestId]);
export function receiptFailure(
  proposal: Pick<
    CommitProposal,
    "saveId" | "epoch" | "requestId" | "fingerprint"
  >,
  head: HeadRef | null,
  error: ReceiptError,
  contentRef: CatalogRef | null = null,
): CommandReceipt {
  return {
    version: 1,
    contentRef,
    saveId: proposal.saveId,
    epoch: proposal.epoch,
    requestId: proposal.requestId,
    fingerprint: proposal.fingerprint,
    status: "rejected",
    before: head,
    after: head,
    error,
    events: [],
    factIds: [],
  };
}

/** Shared storage protocol only; this function never evaluates game rules. */
export function decideCommit<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
>(
  current: R | null,
  existing: C | null,
  proposal: CommitProposal<R, C>,
): { result: CommitResult<C>; write: boolean; record: R | null } {
  const failure = (
    _identity: unknown,
    head: HeadRef | null,
    error: ReceiptError,
    contentRef: StoredRecord["contentRef"] | null = null,
  ): C => ({
    ...structuredClone(proposal.receipt),
    status: "rejected",
    before: head,
    after: head,
    contentRef:
      proposal.receipt.version === 1 ? contentRef : proposal.receipt.contentRef,
    error,
    events: [],
    factIds: [],
  });
  if (existing) {
    if (existing.fingerprint === proposal.fingerprint)
      return {
        result: { receipt: structuredClone(existing), replayed: true },
        write: false,
        record: null,
      };
    const receipt = failure(
      proposal,
      current?.head ?? null,
      {
        code: "request-id-reused",
        path: "clientRequestId",
        message: "Request ID already names different input",
      },
      current?.contentRef ?? null,
    );
    return { result: { receipt, replayed: false }, write: false, record: null };
  }
  if (!sameHead(current?.head ?? null, proposal.expectedHead)) {
    const receipt = failure(
      proposal,
      current?.head ?? null,
      {
        code: current ? "conflict" : "not-found",
        path: "expectedHead",
        message: "Stored head differs from the expected head",
      },
      current?.contentRef ?? null,
    );
    return {
      result: { receipt, replayed: false },
      write: current !== null,
      record: null,
    };
  }
  if (
    proposal.receipt.saveId !== proposal.saveId ||
    proposal.receipt.epoch !== proposal.epoch ||
    proposal.receipt.requestId !== proposal.requestId ||
    proposal.receipt.fingerprint !== proposal.fingerprint ||
    !sameHead(proposal.receipt.before, proposal.expectedHead)
  )
    throw new Error("Invalid receipt identity");
  if (proposal.candidate) {
    const next = proposal.candidate.head;
    if (
      next.saveId !== proposal.saveId ||
      next.epoch !== proposal.epoch ||
      (current
        ? next.revision !== current.head.revision + 1
        : next.revision !== proposal.candidate.commits.length - 1) ||
      !sameHead(proposal.receipt.after, next) ||
      proposal.receipt.status !== "committed"
    )
      throw new Error("Invalid commit proposal");
  } else if (!current) {
    return {
      result: {
        receipt: failure(proposal, null, {
          code: "not-found",
          path: "saveId",
          message: "Save does not exist",
        }),
        replayed: false,
      },
      write: false,
      record: null,
    };
  }
  return {
    result: { receipt: structuredClone(proposal.receipt), replayed: false },
    write: true,
    record: proposal.candidate ? structuredClone(proposal.candidate) : null,
  };
}
