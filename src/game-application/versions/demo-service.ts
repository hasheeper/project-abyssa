import * as v from "../../game-core/contracts";
import type { ValidatedDemoCatalog } from "../../game-core/contracts";
import { createDemoBattleEngine } from "../../game-core/battle";
import type { DemoEvent, JsonValue } from "../../game-core/battle";
import {
  createDemoCampaign, acknowledgeManorStory,
  startDemoExpedition, settleDemoExpedition, asDemoBattle, fromDemoBattle, continueDemoExpedition, advanceDemoRoom, chooseDemoExit, chooseDemoEvent, useDemoItem,
} from "../../game-core/session";
import type { GameStorePort, HeadRef, ReceiptError } from "../contracts";
import { applicationError } from "../service";
import { sameHead } from "../transaction";
import { parseDemoRequest } from "./demo-parse";
import {
  demoFactFields,
  demoFactId,
  validateDemoRecord,
  validateDemoReceipt,
} from "./demo-validate";
import { rebaseDemoRecord } from "./demo-import";
import type {
  DemoGameRecord,
  DemoReceipt,
  DemoRequest,
} from "./demo-contracts";

export type DemoResult =
  | { ok: true; receipt: DemoReceipt; replayed: boolean }
  | { ok: false; error: ReceiptError; receipt?: DemoReceipt };
const result = (receipt: DemoReceipt, replayed: boolean): DemoResult =>
  receipt.status === "committed"
    ? { ok: true, receipt, replayed }
    : { ok: false, error: receipt.error!, receipt };
export function createDemoApplication(
  catalog: ValidatedDemoCatalog,
  store: GameStorePort<DemoGameRecord, DemoReceipt>,
) {
  const version = catalog.ref.rulesVersion;
  const engine = createDemoBattleEngine(catalog);
  const validate = (raw: unknown) => validateDemoRecord(raw, catalog);
  async function read(saveId: string) {
    const raw = await store.read(saveId);
    if (!raw) v.invalid("saveId", "Save not found", "not-found");
    const r = validate(raw);
    if (r.head.saveId !== saveId) v.invalid("head", "Stored key differs");
    return r;
  }
  async function existing(
    saveId: string,
    epoch: string,
    requestId: string,
    fingerprint: string,
  ) {
    const raw = await store.receipt(saveId, epoch, requestId);
    if (!raw) return null;
    const receipt = validateDemoReceipt(raw, catalog);
    if (
      receipt.version !== version ||
      receipt.saveId !== saveId ||
      receipt.epoch !== epoch ||
      receipt.requestId !== requestId ||
      v.canonicalJson(receipt.contentRef) !== v.canonicalJson(catalog.ref)
    )
      v.invalid("receipt", "Stored receipt identity differs");
    if (receipt.fingerprint !== fingerprint)
      v.invalid("clientRequestId", "Request ID reused", "request-id-reused");
    return result(receipt, true);
  }
  function facts(record: DemoGameRecord, events: DemoEvent[], sourceSnapshot = record.snapshot) {
    const index = record.facts.filter((f) =>
      sameHead(f.source, record.head),
    ).length;
    const mapped = events.filter((e) =>
      Object.hasOwn(demoFactFields(version), e.type),
    );
    record.facts.push(
      ...mapped.map((e, i) => ({
        version,
        id: demoFactId(
          record.head.saveId,
          record.head.epoch,
          record.head.revision,
          index + i,
        ),
        source: { ...record.head },
        originRef: null,
        origin: catalog.ref.catalogId.startsWith("abyssa.fixture.")
          ? ("simulation" as const)
          : ("adventure" as const),
        runRef: sourceSnapshot.campaign.activeRunRef,
        encounterId: sourceSnapshot.expedition?.encounter?.id ?? null,
        worldTime: { ...sourceSnapshot.campaign.clock },
        kind: e.type,
        actorId: e.actorId,
        payload: e.payload,
        visibility: ["healing-cost", "facts-retracted"].includes(e.type)
          ? ("internal" as const)
          : ("party" as const),
      })),
    );
  }
  async function write(
    record: DemoGameRecord,
    before: HeadRef | null,
    requestId: string,
    fingerprint: string,
    kind: string,
    events: DemoEvent[],
    sourceSnapshot = record.snapshot,
  ): Promise<DemoResult> {
    facts(record, events, sourceSnapshot);
    const factIds = record.facts
      .filter((f) => sameHead(f.source, record.head))
      .map((f) => f.id);
    record.commits.push({
      ref: { ...record.head },
      previous: before,
      requestId,
      kind,
      factIds,
    });
    const candidate = validate(record);
    const receipt: DemoReceipt = {
      version,
      saveId: record.head.saveId,
      epoch: record.head.epoch,
      requestId,
      fingerprint,
      contentRef: { ...catalog.ref },
      status: "committed",
      before,
      after: { ...record.head },
      error: null,
      events,
      factIds,
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
    return result(committed.receipt, committed.replayed);
  }
  const synthetic = (type: string, payload: JsonValue): DemoEvent[] => [
    { id: `application:${type}`, type, actorId: null, payload },
  ];
  async function createOrImport(
    raw: unknown,
    importing: boolean,
  ): Promise<DemoResult> {
    try {
      v.assertJson(raw);
      const r = v.record(raw, "request", [
        "protocolVersion",
        "saveId",
        "epoch",
        "clientRequestId",
        ...(importing ? ["archive"] : ["profileId"]),
      ]);
      v.choice(r.protocolVersion, [version], "protocolVersion");
      const saveId = v.id(r.saveId, "saveId"),
        epoch = v.id(r.epoch, "epoch"),
        requestId = v.id(r.clientRequestId, "clientRequestId"),
        fingerprint = v.sha256(v.canonicalJson(raw));
      const old = await existing(saveId, epoch, requestId, fingerprint);
      if (old) return old;
      let record: DemoGameRecord, events: DemoEvent[];
      if (importing) {
        const archive = v.record(
          v.parseJson(v.text(r.archive, "archive", v.DATA_LIMITS.characters)),
          "archive",
          ["archiveVersion", "record"],
        );
        v.choice(archive.archiveVersion, [version], "archiveVersion");
        const source = validate(archive.record);
        record = rebaseDemoRecord(source, saveId, epoch);
        record.head.revision++;
        events = synthetic("save-imported", {
          originRevision: source.head.revision,
        });
      } else {
        const profileId = v.id(r.profileId, "profileId");
        record = {
          schemaVersion: version,
          head: { saveId, epoch, revision: 0 },
          contentRef: { ...catalog.ref },
          profileId,
          snapshot: createDemoCampaign(catalog, profileId),
          commits: [],
          facts: [],
          retractedFactIds: [],
          undoAnchors: [],
          originRef: null,
        };
        events = synthetic("save-created", { profileId });
      }
      // An imported chain retains its history, while its first physical write still compares against no save.
      if (importing) {
        const previous = { ...record.head, revision: record.head.revision - 1 };
        facts(record, events);
        const factIds = record.facts
          .filter((f) => sameHead(f.source, record.head))
          .map((f) => f.id);
        if (record.commits.some((c) => c.requestId === requestId))
          v.invalid(
            "requestId",
            "Import request collides with historical request",
          );
        record.commits.push({
          ref: { ...record.head },
          previous,
          requestId,
          kind: "import",
          factIds,
        });
        const receipt: DemoReceipt = {
          version,
          saveId,
          epoch,
          requestId,
          fingerprint,
          contentRef: { ...catalog.ref },
          status: "committed",
          before: null,
          after: record.head,
          error: null,
          events,
          factIds,
        };
        const commit = await store.commit({
          saveId,
          epoch,
          requestId,
          fingerprint,
          expectedHead: null,
          candidate: validate(record),
          receipt,
        });
        return result(commit.receipt, commit.replayed);
      }
      return await write(
        record,
        null,
        requestId,
        fingerprint,
        "create",
        events,
      );
    } catch (e) {
      return { ok: false, error: applicationError(e) };
    }
  }
  async function dispatch(raw: unknown, internal = false): Promise<DemoResult> {
    let request: DemoRequest | undefined, current: DemoGameRecord | undefined;
    const fingerprint = (() => {
      try {
        return v.sha256(v.canonicalJson(raw));
      } catch {
        return "";
      }
    })();
    try {
      request = parseDemoRequest(raw, internal, version);
      const prior = await existing(
        request.saveId,
        request.expectedHead.epoch,
        request.clientRequestId,
        fingerprint,
      );
      if (prior) return prior;
      current = await read(request.saveId);
      if (!sameHead(current.head, request.expectedHead))
        v.invalid("expectedHead", "Stored head differs", "conflict");
      const record = structuredClone(current);
      record.head.revision++;
      const command = request.command;
      let events: DemoEvent[];
      if (command.type === "start-expedition") {
        if (record.facts.some((f) => f.runRef?.id === command.runId))
          v.invalid("runId", "Run identity reused");
        record.snapshot = startDemoExpedition(
          catalog,
          record.profileId,
          record.snapshot,
          command,
        );
        events = synthetic("expedition-started", { runId: command.runId, routeId: command.routeId, partyIds: command.partyIds });
      } else if (command.type === "acknowledge-story") {
        record.snapshot = acknowledgeManorStory(catalog, record.profileId, record.snapshot, command.terminalId, command.step, command.choice);
        const story = record.snapshot.campaign.manor!.story!;
        events = synthetic("story-acknowledged", {terminalId: story.terminalId, step: story.step, status: story.status});
      } else if (command.type === "settle-expedition") {
        const already = record.snapshot.campaign.settlements.some(x => x.runId === command.runRef.id);
        const hadTakeover = !!record.snapshot.campaign.manor?.takeover;
        record.snapshot = settleDemoExpedition(catalog, record.profileId, record.snapshot, command.runRef.id, command.terminalRef);
        events = already ? [] : synthetic("expedition-settled", {...record.snapshot.campaign.settlements.at(-1)!});
        if (!hadTakeover && record.snapshot.campaign.manor?.takeover) {
          const grant = record.snapshot.campaign.manor.takeover, terminal = record.snapshot.campaign.settlements.at(-1)!;
          events.push(...synthetic("manor-program-stopped", {terminalId: terminal.id, runId: terminal.runId, routeId: terminal.routeId, ...terminal.completion!}),
            ...synthetic("manor-takeover-completed", {progressId: grant.id, terminalId: grant.terminalId, runId: grant.runId}),
            ...synthetic("reward-granted", {rewardId: grant.rewardId, terminalId: grant.terminalId, gold: grant.gold}));
        }
      } else {
        const before = record.snapshot.expedition;
        if (!before || before.run.id !== command.runRef.id)
          v.invalid("runRef", "No matching active run", "no-expedition");
        const transition = (() => {
          if (command.type === "resume-run") return continueDemoExpedition(catalog, before);
          if (command.type === "advance-room") return advanceDemoRoom(catalog, before, command.roomId);
          if (command.type === "choose-event") return chooseDemoEvent(catalog, before, command.roomId, command.choiceId, command.actorId);
          if (command.type === "choose-exit") return chooseDemoExit(catalog, before, command.roomId, command.choice);
          if (command.type === "use-item") return useDemoItem(catalog, before, command.instanceId, command.target);
          const battle = asDemoBattle(before);
          if (!battle) v.invalid("battle", "No active encounter", "command-not-available");
          const result = engine.dispatch(battle, command.type === "undo" ? {type: "undo"} : command.command);
          return {state: fromDemoBattle(result.state), events: result.events};
        })();
        events = transition.events;
        record.snapshot.expedition = transition.state;
        if (command.type === "undo") {
          const anchor = record.undoAnchors.pop()!;
          const ids = record.facts
            .filter(
              (f) =>
                f.runRef?.id === before.run.id &&
                f.source.revision > anchor.revision &&
                ![
                  "save-created",
                  "save-imported",
                  "expedition-started",
                  "facts-retracted",
                ].includes(f.kind) &&
                !record.retractedFactIds.includes(f.id),
            )
            .map((f) => f.id);
          record.retractedFactIds.push(...ids);
          events.push(...synthetic("facts-retracted", { factIds: ids }));
        } else if (transition.state.undo.length > before.undo.length)
          record.undoAnchors.push({ ...current.head });
        else if (!transition.state.undo.length) record.undoAnchors = [];
      }
      return await write(
        record,
        current.head,
        request.clientRequestId,
        fingerprint,
        command.type,
        events,
        command.type === "start-expedition" ? record.snapshot : current.snapshot,
      );
    } catch (e) {
      const error = applicationError(e);
      if (
        !request ||
        !current ||
        !(e instanceof v.DataValidationError) ||
        error.code === "request-id-reused"
      )
        return { ok: false, error };
      const receipt: DemoReceipt = {
        version,
        saveId: request.saveId,
        epoch: request.expectedHead.epoch,
        requestId: request.clientRequestId,
        fingerprint,
        contentRef: { ...catalog.ref },
        status: "rejected",
        before: current.head,
        after: current.head,
        error,
        events: [],
        factIds: [],
      };
      try {
        const commit = await store.commit({
          saveId: request.saveId,
          epoch: request.expectedHead.epoch,
          requestId: request.clientRequestId,
          fingerprint,
          expectedHead: request.expectedHead,
          candidate: null,
          receipt,
        });
        return result(commit.receipt, commit.replayed);
      } catch (e) {
        return { ok: false, error: applicationError(e) };
      }
    }
  }
  return {
    create: (raw: unknown) => createOrImport(raw, false),
    importSave: (raw: unknown) => createOrImport(raw, true),
    dispatch: (raw: unknown) => dispatch(raw),
    resumeRun: (raw: unknown) => dispatch(raw, true),
    async open(saveId: string) {
      try {
        return { ok: true as const, record: await read(saveId) };
      } catch (e) {
        return { ok: false as const, error: applicationError(e) };
      }
    },
    async exportSave(saveId: string) {
      try {
        return {
          ok: true as const,
          archive: JSON.stringify({
            archiveVersion: version,
            record: await read(saveId),
          }),
        };
      } catch (e) {
        return { ok: false as const, error: applicationError(e) };
      }
    },
  };
}
