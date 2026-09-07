import * as v from "../game-core/contracts";
import { createBattleEngine, type BattleEvent } from "../game-core/battle";
import {
  createCampaign,
  startExpedition,
  settleExpedition,
  activeExecution,
  fromExecutionState,
} from "../game-core/session";
import type {
  ApplicationDependencies,
  ApplicationResult,
  CommandReceipt,
  GameRecord,
  HeadRef,
  LoadResult,
  ReceiptError,
  SaveListEntry,
} from "./contracts";
import { GameStorageError } from "./contracts";
import { parseCommandRequest } from "./parse";
import { validateRecord } from "./validate";
import { eventFacts, fact, factId, settlementId } from "./facts";
import { receiptFailure, sameHead } from "./transaction";

export function applicationError(error: unknown): ReceiptError {
  if (error instanceof v.DataValidationError)
    return { code: error.code, path: error.path, message: error.message };
  if (error instanceof GameStorageError)
    return { code: error.code, path: "storage", message: error.message };
  return {
    code: "internal-error",
    path: "$",
    message: "Application operation failed",
  };
}
const resultOf = (
  receipt: CommandReceipt,
  replayed: boolean,
): ApplicationResult =>
  receipt.status === "committed"
    ? { ok: true, receipt, replayed }
    : { ok: false, error: receipt.error!, receipt };

export function createGameApplication({
  catalog,
  store,
}: ApplicationDependencies) {
  const validate = (raw: unknown) => validateRecord(raw, catalog);
  async function read(saveId: string) {
    const raw = await store.read(saveId);
    if (!raw) v.invalid("saveId", "Save not found", "not-found");
    const record = validate(raw);
    if (record.head.saveId !== saveId) v.invalid("head.saveId", "Stored identity differs from key");
    return record;
  }
  async function existing(
    saveId: string,
    epoch: string,
    requestId: string,
    fingerprint: string,
  ): Promise<ApplicationResult | null> {
    const old = await store.receipt(saveId, epoch, requestId);
    if (!old) return null;
    if (old.fingerprint !== fingerprint)
      return {
        ok: false,
        error: {
          code: "request-id-reused",
          path: "clientRequestId",
          message: "Request ID already names different input",
        },
      };
    return resultOf(old, true);
  }
  async function write(
    record: GameRecord,
    before: HeadRef | null,
    requestId: string,
    fingerprint: string,
    kind: string,
    events: BattleEvent[] = [],
  ): Promise<ApplicationResult> {
    record.commits.push({
      ref: { ...record.head },
      previous: before,
      requestId,
      kind,
      factIds: record.facts
        .filter((f) => sameHead(f.source, record.head))
        .map((f) => f.id),
    });
    const candidate = validate(record);
    const receipt: CommandReceipt = {
      version: 1,
      contentRef: { ...catalog.ref },
      saveId: record.head.saveId,
      epoch: record.head.epoch,
      requestId,
      fingerprint,
      status: "committed",
      before,
      after: { ...record.head },
      error: null,
      events,
      factIds: candidate.commits.at(-1)!.factIds,
    };
    const committed = await store.commit({
      saveId: record.head.saveId,
      epoch: record.head.epoch,
      requestId,
      fingerprint,
      expectedHead: before,
      candidate,
      receipt,
    });
    return resultOf(committed.receipt, committed.replayed);
  }
  function base(head: HeadRef): GameRecord {
    return {
      schemaVersion: 1,
      head,
      contentRef: { ...catalog.ref },
      snapshot: createCampaign(catalog),
      commits: [],
      facts: [],
      retractedFactIds: [],
      undoAnchors: [],
      pendingSettlement: null,
      originRef: null,
    };
  }
  function markTerminal(record: GameRecord) {
    if (record.snapshot.expedition?.lifecycle.type === "finished")
      record.pendingSettlement = {
        expeditionId: record.snapshot.expedition.id,
        terminalRef: { ...record.head },
        settlementId: settlementId(record.head, record.snapshot.expedition.id),
      };
  }
  async function createOrImport(
    raw: unknown,
    importing: boolean,
  ): Promise<ApplicationResult> {
    try {
      v.assertJson(raw);
      const r = v.record(
        raw,
        "request",
        [
          "protocolVersion",
          "saveId",
          "epoch",
          "clientRequestId",
          ...(importing ? ["format", "archive"] : []),
        ],
        importing ? [] : ["initial"],
      );
      v.choice(r.protocolVersion, [1], "protocolVersion");
      const saveId = v.id(r.saveId, "saveId"),
        epoch = v.id(r.epoch, "epoch"),
        requestId = v.id(r.clientRequestId, "clientRequestId"),
        fingerprint = v.sha256(v.canonicalJson(raw));
      const prior = await existing(saveId, epoch, requestId, fingerprint);
      if (prior) return prior;
      let record = base({ saveId, epoch, revision: 0 });
      let previous: HeadRef | null = null;
      if (!importing)
        record.snapshot = createCampaign(catalog, r.initial ?? {});
      else if (
        v.choice(r.format, ["application", "legacy"], "format") === "legacy"
      ) {
        const engine = createBattleEngine(catalog, catalog.data.defaultRouteId),
          state = engine.importLegacy(
            v.text(r.archive, "archive", v.DATA_LIMITS.characters),
          );
        record.snapshot = createCampaign(catalog, {
          availableCharacterIds: state.party.map((p) => p.id),
          inventory: { capacity: 256, items: [], equipment: [] },
          traits: state.loadout.traits,
        });
        const expeditionId = `import:${v.sha256(v.canonicalJson([saveId, epoch]))}`;
        record.snapshot = {
          ...record.snapshot,
          ...fromExecutionState(
            catalog,
            expeditionId,
            catalog.data.defaultRouteId,
            state,
          ),
        };
        record.snapshot.campaign.activeExpeditionId = expeditionId;
        record.undoAnchors = state.undoStack.map(() => ({ ...record.head }));
      } else {
        const archive = v.record(
          v.parseJson(v.text(r.archive, "archive", v.DATA_LIMITS.characters)),
          "archive",
          ["archiveVersion", "record"],
        );
        v.choice(archive.archiveVersion, [1], "archiveVersion");
        const old = validate(archive.record);
        if (old.head.saveId === saveId || old.head.epoch === epoch)
          v.invalid("saveId", "Import requires a new save and epoch");
        record = structuredClone(old);
        const source = { ...old.head };
        const mapHead = (h: HeadRef): HeadRef => ({
          saveId,
          epoch,
          revision: h.revision,
        });
        const mapExp = (id: string) =>
          `import:${v.sha256(v.canonicalJson([saveId, epoch, id]))}`;
        const mapFact = new Map<string, string>();
        for (const c of record.commits)
          c.factIds.forEach((id, i) =>
            mapFact.set(id, factId(mapHead(c.ref), i)),
          );
        record.facts = record.facts.map((f) => ({
          ...f,
          id: mapFact.get(f.id)!,
          originRef: { ...f.source },
          source: mapHead(f.source),
          origin: f.origin === "simulation" ? "simulation" : "imported",
          expeditionId: f.expeditionId ? mapExp(f.expeditionId) : null,
          encounterId:
            f.encounterId && f.expeditionId
              ? `${mapExp(f.expeditionId)}:encounter:${f.encounterId.split(":encounter:").at(-1)}`
              : null,
          payload:
            f.kind === "facts-retracted"
              ? {
                  factIds: (f.payload as { factIds: string[] }).factIds.map(
                    (id) => mapFact.get(id)!,
                  ),
                }
              : f.kind === "expedition-settled"
                ? {
                    ...(f.payload as object),
                    settlementId: settlementId(
                      { saveId, epoch, revision: 0 },
                      mapExp(f.expeditionId!),
                    ),
                  }
                : f.payload,
        }));
        record.commits = record.commits.map((c) => ({
          ...c,
          ref: mapHead(c.ref),
          previous: c.previous ? mapHead(c.previous) : null,
          requestId: `history:${v.sha256(v.canonicalJson([c.ref, c.requestId]))}`,
          factIds: c.factIds.map((id) => mapFact.get(id)!),
        }));
        record.retractedFactIds = record.retractedFactIds.map((id) =>
          mapFact.get(id)!,
        );
        record.undoAnchors = record.undoAnchors.map(mapHead);
        record.originRef = source;
        record.head = { saveId, epoch, revision: source.revision + 1 };
        previous = mapHead(source);
        for (const entry of record.snapshot.campaign.appliedSettlements) {
          entry.expeditionId = mapExp(entry.expeditionId);
          entry.id = settlementId(record.head, entry.expeditionId);
        }
        if (record.snapshot.expedition) {
          record.snapshot.expedition.id = mapExp(record.snapshot.expedition.id);
          record.snapshot.campaign.activeExpeditionId =
            record.snapshot.expedition.id;
          record.snapshot.encounter!.id = `${record.snapshot.expedition.id}:encounter:${record.snapshot.expedition.layer}`;
        }
        record.pendingSettlement = null;
      }
      markTerminal(record);
      record.facts.push(
        fact(
          record,
          importing ? "save-imported" : "save-created",
          { originRevision: record.originRef?.revision ?? null },
          0,
          true,
        ),
      );
      // Imported history remains a contiguous audit chain; the store still CASes against absence.
      record.commits.push({
        ref: { ...record.head },
        previous,
        requestId,
        kind: importing ? "import" : "create",
        factIds: [record.facts.at(-1)!.id],
      });
      const candidate = validate(record),
        receipt: CommandReceipt = {
          version: 1,
          contentRef: { ...catalog.ref },
          saveId,
          epoch,
          requestId,
          fingerprint,
          status: "committed",
          before: null,
          after: { ...record.head },
          error: null,
          events: [],
          factIds: [record.facts.at(-1)!.id],
        };
      const committed = await store.commit({
        saveId,
        epoch,
        requestId,
        fingerprint,
        expectedHead: null,
        candidate,
        receipt,
      });
      return resultOf(committed.receipt, committed.replayed);
    } catch (error) {
      return { ok: false, error: applicationError(error) };
    }
  }
  async function dispatch(
    raw: unknown,
    internal = false,
  ): Promise<ApplicationResult> {
    let request: ReturnType<typeof parseCommandRequest>;
    try {
      request = parseCommandRequest(raw, internal);
    } catch (error) {
      return { ok: false, error: applicationError(error) };
    }
    const {
        saveId,
        clientRequestId: requestId,
        expectedHead,
        command,
      } = request,
      epoch = expectedHead.epoch,
      fingerprint = v.sha256(v.canonicalJson(request));
    const scope = { saveId, epoch, requestId, fingerprint };
    try {
      const prior = await existing(saveId, epoch, requestId, fingerprint);
      if (prior) return prior;
      const current = await read(saveId);
      if (!sameHead(current.head, expectedHead)) {
        const committed = await store.commit({
          ...scope,
          expectedHead,
          candidate: null,
          receipt: receiptFailure(scope, current.head, {
            code: "conflict",
            path: "expectedHead",
            message: "Stored head differs",
          }),
        });
        return resultOf(committed.receipt, committed.replayed);
      }
      try {
        const next = structuredClone(current);
        next.head = { ...current.head, revision: current.head.revision + 1 };
        let events: BattleEvent[] = [];
        if (command.type === "start-expedition") {
          if (command.partyIds.length < 2)
            v.invalid(
              "partyIds",
              "An expedition requires the leader and at least one companion",
            );
          next.snapshot = startExpedition(current.snapshot, catalog, command);
          next.undoAnchors = [];
          next.facts.push(
            fact(
              next,
              "expedition-started",
              { routeId: command.routeId, partyIds: command.partyIds },
              0,
            ),
          );
        } else if (command.type === "settle-expedition") {
          if (
            current.snapshot.campaign.appliedSettlements.some(
              (s) => s.expeditionId === command.expeditionId,
            )
          )
            v.invalid(
              "expeditionId",
              "Expedition already settled",
              "already-settled",
            );
          const pending = current.pendingSettlement;
          if (!pending)
            v.invalid(
              "pendingSettlement",
              "Expedition is not finished",
              "not-finished",
            );
          if (
            pending.expeditionId !== command.expeditionId ||
            !sameHead(pending.terminalRef, command.terminalRef)
          )
            v.invalid("terminalRef", "Terminal source mismatch", "conflict");
          const outcome = current.snapshot.expedition!.lifecycle;
          if (outcome.type !== "finished")
            v.invalid("expedition", "Not finished", "not-finished");
          next.facts.push(
            fact(
              next,
              "expedition-settled",
              { ...outcome.result, settlementId: pending.settlementId },
              0,
            ),
          );
          next.snapshot = settleExpedition(
            current.snapshot,
            catalog,
            pending.settlementId,
            command.expeditionId,
          );
          next.pendingSettlement = null;
          next.undoAnchors = [];
        } else {
          const expedition = current.snapshot.expedition;
          if (expedition?.id !== command.expeditionId)
            v.invalid(
              "expeditionId",
              "No matching active expedition",
              "no-expedition",
            );
          const engine = createBattleEngine(catalog, expedition.routeId);
          let state = activeExecution(current.snapshot);
          if (
            command.type !== "resume-enemy-turn" &&
            state.mode.type === "enemy-turn" &&
            state.mode.outcome === null
          )
            v.invalid(
              "mode",
              "Resume the persisted enemy batch before accepting player commands",
              "resume-required",
            );
          const run = (cmd: unknown) => {
            const transition = engine.dispatch(state, cmd);
            if (transition.error)
              v.invalid("command", transition.error, transition.error);
            state = transition.state;
            events.push(...transition.events);
          };
          if (command.type === "resume-enemy-turn") {
            if (state.mode.type !== "enemy-turn" || state.mode.outcome !== null)
              v.invalid(
                "mode",
                "No interrupted enemy batch",
                "command-not-available",
              );
            while (
              state.mode.type === "enemy-turn" &&
              state.mode.cursor < state.mode.enemyOrder.length
            )
              run({ type: "resolve-next-enemy" });
            run({ type: "finish-enemy-turn" });
          } else
            run(command.type === "undo" ? { type: "undo" } : command.command);
          next.snapshot = {
            ...next.snapshot,
            ...fromExecutionState(
              catalog,
              expedition.id,
              expedition.routeId,
              state,
            ),
          };
          if (command.type === "undo") {
            const anchor = next.undoAnchors.pop()!;
            const retracted = next.facts
              .filter(
                (f) =>
                  f.expeditionId === expedition.id &&
                  f.source.revision > anchor.revision &&
                  [
                    "damage-applied",
                    "healing-applied",
                    "resource-changed",
                    "layer-cleared",
                    "expedition-finished",
                  ].includes(f.kind) &&
                  !next.retractedFactIds.includes(f.id),
              )
              .map((f) => f.id);
            next.retractedFactIds.push(...retracted);
            next.facts.push(
              fact(next, "facts-retracted", { factIds: retracted }, 0, true),
            );
          } else {
            const count = state.undoStack.length,
              oldCount = current.undoAnchors.length;
            if (count === oldCount + 1)
              next.undoAnchors.push({ ...current.head });
            else if (count === 0) next.undoAnchors = [];
            else if (count !== oldCount)
              v.invalid(
                "undoAnchors",
                "Unexpected checkpoint transition",
                "invariant-violation",
              );
            next.facts.push(...eventFacts(next, events));
          }
          markTerminal(next);
        }
        return await write(
          next,
          current.head,
          requestId,
          fingerprint,
          command.type,
          events,
        );
      } catch (error) {
        // Only domain/data rejection is durable. Storage failure must remain retryable.
        if (!(error instanceof v.DataValidationError)) throw error;
        const receipt = receiptFailure(
          scope,
          current.head,
          applicationError(error),
          current.contentRef,
        );
        const committed = await store.commit({
          ...scope,
          expectedHead,
          candidate: null,
          receipt,
        });
        return resultOf(committed.receipt, committed.replayed);
      }
    } catch (error) {
      return { ok: false, error: applicationError(error) };
    }
  }
  return {
    create: (raw: unknown) => createOrImport(raw, false),
    importSave: (raw: unknown) => createOrImport(raw, true),
    dispatch: (raw: unknown) => dispatch(raw),
    resumeEnemyTurn: (raw: unknown) => dispatch(raw, true),
    async open(saveId: unknown): Promise<LoadResult> {
      try {
        return { ok: true, record: await read(v.id(saveId, "saveId")) };
      } catch (error) {
        return { ok: false, error: applicationError(error) };
      }
    },
    async list() {
      try {
        const saves: SaveListEntry[] = [];
        for (const saveId of await store.listSaveIds()) {
          try {
            const record = await read(saveId);
            saves.push({ status: "ready", saveId, summary: {
              head: record.head, contentRef: record.contentRef,
              activeExpeditionId: record.snapshot.campaign.activeExpeditionId,
            }, clock: record.snapshot.campaign.clock });
          } catch (error) {
            if (error instanceof GameStorageError) throw error;
            saves.push({ status: "unavailable", saveId, error: applicationError(error) });
          }
        }
        return { ok: true as const, saves };
      } catch (error) {
        return { ok: false as const, error: applicationError(error) };
      }
    },
    async exportDiagnostic(saveId: unknown) {
      try {
        const id = v.id(saveId, "saveId"),
          rawRecord = await store.read(id);
        if (!rawRecord) v.invalid("saveId", "Save not found", "not-found");
        v.assertJson(rawRecord);
        return {
          ok: true as const,
          archive: JSON.stringify({ diagnosticVersion: 1, rawRecord }),
        };
      } catch (error) {
        return { ok: false as const, error: applicationError(error) };
      }
    },
    async exportSave(saveId: unknown) {
      try {
        return {
          ok: true as const,
          archive: JSON.stringify({
            archiveVersion: 1,
            record: await read(v.id(saveId, "saveId")),
          }),
        };
      } catch (error) {
        return { ok: false as const, error: applicationError(error) };
      }
    },
  };
}
export type GameApplication = ReturnType<typeof createGameApplication>;
