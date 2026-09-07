import { createD5LineageApplication } from "../game-application/versions/d5-lineage";
import * as v from "../game-core/contracts";
import {
  applicationError,
  createGameApplication,
  createDemoApplication,
  createD5Application,
} from "../game-application";
import type {
  AnyGameRecord,
  AnyReceipt,
  CommandReceipt,
  DemoGameRecord,
  D5GameRecord,
  D5Receipt,
  DemoReceipt,
  GameRecord,
  GameStorePort,
  VersionedGameStore,
} from "../game-application";
import { createCatalogRegistry, type CatalogRegistration } from "./catalogs";
import { createVersionedQueries } from "./versioned-views";

/** Checked storage bridge. Each service retains its strict version-specific reader. */
function narrowStore<R extends AnyGameRecord, C extends AnyReceipt>(
  store: VersionedGameStore,
  version: R["schemaVersion"],
): GameStorePort<R, C> {
  const receipt = (raw: AnyReceipt): C => {
    v.assertJson(raw);
    if (raw.version !== version)
      v.invalid(
        "receipt.version",
        "Receipt belongs to another protocol",
        "version-mismatch",
      );
    return raw as C;
  };
  return {
    async read(id) {
      const raw = await store.read(id);
      if (raw && raw.schemaVersion !== version)
        v.invalid(
          "schemaVersion",
          "Save belongs to another version",
          "version-mismatch",
        );
      return raw as R | null;
    },
    listSaveIds: () => store.listSaveIds(),
    async receipt(...args) {
      const raw = await store.receipt(...args);
      return raw ? receipt(raw) : null;
    },
    async commit(proposal) {
      const committed = await store.commit(proposal);
      return { ...committed, receipt: receipt(committed.receipt) };
    },
  };
}
/** Select the matching rules/content service without changing existing saves. */
export function createVersionedGameRuntime(
  store: VersionedGameStore,
  registrations: CatalogRegistration[],
) {
  const registry = createCatalogRegistry(registrations);
  const d5Services = new Map<string, ReturnType<typeof createD5Application>>();
  function d5Service(catalog: import("../game-core/contracts").ValidatedD5Catalog) {
    let service = d5Services.get(catalog.ref.digest);
    if (!service) {service = createD5Application(catalog, narrowStore<D5GameRecord, D5Receipt>(store, 4), registry.readers); d5Services.set(catalog.ref.digest, service);}
    return service;
  }
  const service = (entry: CatalogRegistration) =>
    entry.version === 1
      ? createGameApplication({
          catalog: entry.catalog,
          store: narrowStore<GameRecord, CommandReceipt>(store, 1),
        })
      : entry.version === 4 ? d5Service(entry.catalog) : createDemoApplication(
          entry.catalog,
          narrowStore<DemoGameRecord, DemoReceipt>(store, entry.version),
        );
  const failure = (e: unknown) => ({
    ok: false as const,
    error: applicationError(e),
  });
  async function read(id: unknown) {
    const saveId = v.id(id, "saveId"),
      raw = await store.read(saveId);
    if (!raw) v.invalid("saveId", "Save not found", "not-found");
    const record = registry.read(raw);
    if (record.head.saveId !== saveId)
      v.invalid("head.saveId", "Storage key differs");
    return record;
  }
  async function dispatch(raw: unknown, resume = false) {
    try {
      v.assertJson(raw);
      const envelope = v.record(raw, "request");
      // Select the service here; its reader validates the freshly read record.
      // Do not validate the full history twice before executing one command.
      const stored = await store.read(v.id(envelope.saveId, "saveId"));
      if (!stored) v.invalid("saveId", "Save not found", "not-found");
      const record = v.record(stored, "record");
      if (envelope.protocolVersion !== record.schemaVersion)
        v.invalid(
          "protocolVersion",
          "Request/save version mismatch",
          "version-mismatch",
        );
      const entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (!resume) return await service(entry).dispatch(raw);
      return entry.version === 1
        ? await createGameApplication({
            catalog: entry.catalog,
            store: narrowStore<GameRecord, CommandReceipt>(store, 1),
          }).resumeEnemyTurn(raw)
        : entry.version === 4 ? await d5Service(entry.catalog).resumeRun(raw) : await createDemoApplication(
            entry.catalog,
            narrowStore<DemoGameRecord, DemoReceipt>(store, entry.version),
          ).resumeRun(raw);
    } catch (e) {
      return failure(e);
    }
  }
  return {
    queries: createVersionedQueries(registry),
    async open(saveId: unknown) {
      try {
        return { ok: true as const, record: await read(saveId) };
      } catch (e) {
        return failure(e);
      }
    },
    async list() {
      try {
        return {
          ok: true as const,
          saves: await Promise.all(
            (await store.listSaveIds()).map(async (saveId) => {
              try {
                const record = await read(saveId);
                return {
                  status: "ready" as const,
                  saveId,
                  head: record.head,
                  contentRef: record.contentRef,
                  clock: record.snapshot.campaign.clock,
                  continuation: record.schemaVersion === 3 || record.schemaVersion === 4 ? (()=>{
                    const c=record.snapshot.campaign, eligible=!c.activeRunRef && c.manor?.story?.status!=="pending" && (record.schemaVersion!==4 || !record.snapshot.campaign.activeStoryId && (!record.snapshot.campaign.memory || record.snapshot.campaign.memory.node==="completed"));
                    return {upgrade:eligible && (record.schemaVersion===3 || record.contentRef.contentVersion===2),cycle:eligible && record.schemaVersion===4 && !!record.snapshot.campaign.chapterClaim};
                  })() : {upgrade:false,cycle:false},
                  activeRunId: record.schemaVersion !== 1 ? record.snapshot.campaign.activeRunRef?.id ?? null : record.snapshot.campaign.activeExpeditionId,
                };
              } catch (e) {
                return {
                  status: "unavailable" as const,
                  saveId,
                  error: applicationError(e),
                };
              }
            }),
          ),
        };
      } catch (e) {
        return failure(e);
      }
    },
    // Catalog identity is an explicit outer selector; the exact inner request remains replayable.
    async create(raw: unknown) {
      try {
        v.assertJson(raw);
        const r = v.record(raw, "create", ["contentRef", "request"]),
          request = v.record(r.request, "request"),
          entry = registry.resolve(request.protocolVersion, r.contentRef);
        const existing = await store.read(v.id(request.saveId, "saveId"));
        if (
          existing &&
          (existing.schemaVersion !== entry.version ||
            v.canonicalJson(existing.contentRef) !==
              v.canonicalJson(entry.catalog.ref))
        )
          v.invalid(
            "saveId",
            "Save already belongs to another Catalog",
            "content-mismatch",
          );
        return await service(entry).create(r.request);
      } catch (e) {
        return failure(e);
      }
    },
    async importSave(raw: unknown) {
      try {
        v.assertJson(raw);
        const r = v.record(raw, "import", ["contentRef", "request"]),
          request = v.record(r.request, "request");
        const entry = registry.resolve(request.protocolVersion, r.contentRef);
        if (entry.version === 4) {
          v.record(request,"request",["protocolVersion","saveId","epoch","clientRequestId","archive"]);
          const archive = v.record(v.parseJson(v.text(request.archive,"archive",8*1024*1024)),"archive",["archiveVersion","record"]);
          v.choice(archive.archiveVersion,[4],"archiveVersion");
          return createD5LineageApplication(entry.catalog,narrowStore<D5GameRecord,D5Receipt>(store,4),registry.readers,registry.read)({saveId:request.saveId,epoch:request.epoch,clientRequestId:request.clientRequestId,kind:"copy",source:archive.record});
        }
        const selected = service(entry);
        if (!("importSave" in selected)) v.invalid("import", "Import unavailable", "content-unavailable");
        return await selected.importSave(r.request);
      } catch (e) {
        return failure(e);
      }
    },
    async continueSave(raw: unknown) {
      try {
        const r = v.record(raw,"continueSave",["contentRef","sourceSaveId","expectedSourceHead","saveId","epoch","clientRequestId","kind"]);
        const entry = registry.resolve(4,r.contentRef);
        if(entry.version!==4) v.invalid("contentRef","Expected D5");
        let source=await read(r.sourceSaveId);
        const prior=await store.receipt(v.id(r.saveId,"saveId"),v.id(r.epoch,"epoch"),v.id(r.clientRequestId,"clientRequestId"));
        if(prior?.status === "committed") {
          const target=await read(r.saveId);
          if(target.schemaVersion===4 && target.originRef && target.originRef.kind===r.kind && target.originRef.source.head.saveId===r.sourceSaveId) source=target.originRef.source;
        }
        if(v.canonicalJson(source.head)!==v.canonicalJson(r.expectedSourceHead)) v.invalid("expectedSourceHead","Source changed; reopen the archive","conflict");
        v.choice(r.kind,["upgrade","cycle"],"kind");
        return createD5LineageApplication(entry.catalog,narrowStore<D5GameRecord,D5Receipt>(store,4),registry.readers,registry.read)({saveId:r.saveId,epoch:r.epoch,clientRequestId:r.clientRequestId,kind:r.kind,source});
      } catch(e) {return failure(e);}
    },
    dispatch: (raw: unknown) => dispatch(raw),
    resume: (raw: unknown) => dispatch(raw, true),
    async exportSave(saveId: unknown) {
      try {
        const record = await read(saveId);
        return {
          ok: true as const,
          archive: JSON.stringify({
            archiveVersion: record.schemaVersion,
            record,
          }),
        };
      } catch (e) {
        return failure(e);
      }
    },
    async exportDiagnostic(saveId: unknown) {
      try {
        const rawRecord = await store.read(v.id(saveId, "saveId"));
        if (!rawRecord) v.invalid("saveId", "Save not found", "not-found");
        v.assertJson(rawRecord);
        return {
          ok: true as const,
          archive: JSON.stringify({ diagnosticVersion: 1, rawRecord }),
        };
      } catch (e) {
        return failure(e);
      }
    },
  };
}
