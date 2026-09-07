import { deriveD5Baseline } from "../game-application/versions/d5-lineage";
import type { D5RunReaders } from "../game-core/session";
import { D5_RUN_READERS } from "../game-core/session";
import * as v from "../game-core/contracts";
import type {
  ValidatedCatalog,
  ValidatedD5Catalog,
  ValidatedDemoCatalog,
} from "../game-core/contracts";
import { validateRecord, validateDemoRecord, validateD5Record, type AnyGameRecord } from "../game-application";

export type CatalogRegistration =
  | { version: 1; catalog: ValidatedCatalog }
  | { version: 2 | 3; catalog: ValidatedDemoCatalog }
  | { version: 4; catalog: ValidatedD5Catalog };
/** Immutable registry, injected per runtime; never a mutable globally selected ruleset. */
export function createCatalogRegistry(input: CatalogRegistration[]) {
  // Only this registry's validated, deeply frozen copies can bypass validation.
  // Storage/import values and caller-frozen objects always pass the strict reader.
  const latestD5 = new Map<string, import("../game-application").D5GameRecord>();
  const snapshots = new WeakSet<AnyGameRecord>();
  const entries = input.map((e) =>
    e.version === 1
      ? {
          version: 1 as const,
          catalog: v.validateCatalog(e.catalog.data, e.catalog.ref),
        }
      : e.version === 4 ? { version: 4 as const, catalog: v.validateD5Catalog(e.catalog.data, e.catalog.ref) } : {
          version: e.version,
          catalog: (e.version === 3 ? v.validateManorCatalog : v.validateDemoCatalog)(e.catalog.data, e.catalog.ref),
        },
  );
  const key = (ref: {
    catalogId: string;
    contentVersion: number;
    rulesVersion: number;
  }) => v.canonicalJson([ref.catalogId, ref.contentVersion, ref.rulesVersion]);
  if (new Set(entries.map((e) => key(e.catalog.ref))).size !== entries.length)
    v.invalid("registry", "Duplicate Catalog registration");
  function resolve(version: unknown, raw: unknown): CatalogRegistration {
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4)
      v.invalid("version", "Unsupported version", "unsupported-schema");
    const r = v.record(raw, "contentRef", [
      "catalogId",
      "contentVersion",
      "rulesVersion",
      "digest",
    ]);
    const ref = {
      catalogId: v.id(r.catalogId, "catalogId"),
      contentVersion: v.number(r.contentVersion, "contentVersion", 1),
      rulesVersion: v.number(r.rulesVersion, "rulesVersion", 1),
      digest: v.text(r.digest, "digest", 64),
    };
    if (ref.rulesVersion !== version)
      v.invalid(
        "version",
        "Schema/protocol and rules mismatch",
        "version-mismatch",
      );
    const entry = entries.find(
      (e) => e.version === version && key(e.catalog.ref) === key(ref),
    );
    if (!entry)
      v.invalid(
        "contentRef",
        "Catalog is not registered",
        "content-unavailable",
      );
    if (entry.catalog.ref.digest !== ref.digest)
      v.invalid("contentRef", "Catalog digest mismatch", "content-mismatch");
    return entry;
  }
  let depth = 0;
  const origins = new Map<string, import("../game-core/session").D5Baseline>();
  const readers: D5RunReaders = {...D5_RUN_READERS, resolveOrigin(raw,catalog) {
    if (++depth > 8) {depth--; v.invalid("originRef", "Archive lineage exceeds eight generations");}
    try {
      const origin = v.record(raw,"originRef",["kind","source"]);
      const kind = v.choice(origin.kind,["copy","upgrade","cycle"],"originRef.kind");
      const key = catalog.ref.digest + v.sha256(v.canonicalJson(raw));
      const existing = origins.get(key);
      if (existing) return existing;
      const baseline = v.freezeData(deriveD5Baseline(catalog,read(origin.source),kind));
      if(origins.size > 16) origins.clear();
      origins.set(key,baseline);
      return baseline;
    } finally {depth--;}
  }};
  function read(raw: unknown): AnyGameRecord {
    if (raw !== null && typeof raw === "object" && snapshots.has(raw as AnyGameRecord))
      return raw as AnyGameRecord;
    v.assertJson(raw);
    const envelope = v.record(raw, "record");
    const entry = resolve(envelope.schemaVersion, envelope.contentRef);
    const snapshot = entry.version === 1
      ? validateRecord(raw, entry.catalog)
      : entry.version === 4 ? (() => { const id = v.id(v.record(envelope.head, "head").saveId, "saveId"); const prior = latestD5.get(id); const checked = prior && v.canonicalJson(prior) === v.canonicalJson(raw) ? prior : validateD5Record(raw, entry.catalog, readers, prior); latestD5.set(id, checked); return checked; })() : validateDemoRecord(raw, entry.catalog);
    v.freezeData(snapshot);
    snapshots.add(snapshot);
    return snapshot;
  }
  return { resolve, read, readers };
}
export type CatalogRegistry = ReturnType<typeof createCatalogRegistry>;
