import * as v from "../game-core/contracts";
import { validateSnapshot } from "../game-core/session";
import type { GameRecord, ValidatedCatalog } from "./contracts";
import { parseHead } from "./parse";
import { sameHead } from "./transaction";
import { factId, settlementId, validateFactPayload } from "./facts";
export function validateRecord(
  raw: unknown,
  catalog: ValidatedCatalog,
): GameRecord {
  v.assertJson(raw);
  const r = v.record(raw, "save", [
    "schemaVersion",
    "head",
    "contentRef",
    "snapshot",
    "commits",
    "facts",
    "retractedFactIds",
    "undoAnchors",
    "pendingSettlement",
    "originRef",
  ]);
  if (r.schemaVersion !== 1)
    v.invalid(
      "schemaVersion",
      "Unsupported application schema",
      "unsupported-schema",
    );
  const ref = v.record(r.contentRef, "contentRef", [
    "catalogId",
    "contentVersion",
    "rulesVersion",
    "digest",
  ]);
  if (ref.rulesVersion !== catalog.ref.rulesVersion)
    v.invalid(
      "contentRef.rulesVersion",
      "Unsupported rules",
      "unsupported-rules",
    );
  if (
    ref.catalogId !== catalog.ref.catalogId ||
    ref.contentVersion !== catalog.ref.contentVersion
  )
    v.invalid("contentRef", "Required Catalog unavailable", "missing-content");
  if (v.canonicalJson(ref) !== v.canonicalJson(catalog.ref))
    v.invalid(
      "contentRef.digest",
      "Catalog identity differs",
      "content-mismatch",
    );
  const head = parseHead(r.head);
  const snapshot = validateSnapshot(r.snapshot, catalog);
  const historyRef = (raw: unknown) => {
    const h = parseHead(raw);
    if (
      h.saveId !== head.saveId ||
      h.epoch !== head.epoch ||
      h.revision > head.revision
    )
      v.invalid("source", "Reference outside save history");
    return h;
  };
  if (r.originRef !== null) parseHead(r.originRef, "originRef");
  const commits = v.list(r.commits, "commits"),
    facts = v.list(r.facts, "facts");
  if (commits.length !== head.revision + 1)
    v.invalid("commits", "History is not contiguous");
  const referenced = new Map<string, { revision: number; index: number }>();
  const requestIds = new Set<string>();
  commits.forEach((raw, i) => {
    const c = v.record(raw, "commit", [
      "ref",
      "previous",
      "requestId",
      "kind",
      "factIds",
    ]);
    const h = historyRef(c.ref);
    if (
      h.revision !== i ||
      !sameHead(
        c.previous === null ? null : historyRef(c.previous),
        i ? { ...head, revision: i - 1 } : null,
      )
    )
      v.invalid("commit", "Broken commit chain");
    const id = v.id(c.requestId, "requestId");
    if (requestIds.has(id)) v.invalid("commits", "Duplicate request identity");
    requestIds.add(id);
    v.choice(
      c.kind,
      [
        "create",
        "import",
        "start-expedition",
        "battle-command",
        "undo",
        "resume-enemy-turn",
        "settle-expedition",
      ],
      "commit.kind",
    );
    v.ids(c.factIds, "commit.factIds").forEach((id, index) => {
      if (referenced.has(id) || id !== factId(h, index))
        v.invalid("commit.factIds", "Invalid fact identity");
      referenced.set(id, { revision: i, index });
    });
  });
  const seen = new Set<string>();
  facts.forEach((raw) => {
    const f = v.record(
      raw,
      "fact",
      [
        "version",
        "id",
        "source",
        "origin",
        "expeditionId",
        "encounterId",
        "worldTime",
        "kind",
        "payload",
        "visibility",
      ],
      ["originRef"],
    );
    v.choice(f.version, [1], "fact.version");
    const id = v.id(f.id, "fact.id"),
      source = historyRef(f.source);
    if (seen.has(id) || referenced.get(id)?.revision !== source.revision)
      v.invalid("fact.id", "Unbound or duplicate fact");
    seen.add(id);
    v.choice(f.origin, ["adventure", "imported", "simulation"], "fact.origin");
    if (f.originRef !== undefined) parseHead(f.originRef);
    for (const k of ["expeditionId", "encounterId"])
      if (f[k] !== null) v.id(f[k], `fact.${k}`);
    const time = v.record(f.worldTime, "worldTime", ["day", "phase"]);
    v.number(time.day, "day", 1);
    v.choice(time.phase, ["dawn", "day", "dusk", "night"], "phase");
    validateFactPayload(f.kind, f.payload);
    if (
      f.encounterId !== null &&
      (f.expeditionId === null ||
        !String(f.encounterId).startsWith(`${f.expeditionId}:encounter:`) ||
        !/^\d+$/.test(String(f.encounterId).split(":encounter:").at(-1)!))
    )
      v.invalid("fact.encounterId", "Encounter is outside the expedition");
    const payload = f.payload as Record<string, unknown>;
    if (
      f.kind === "healing-applied" ||
      (f.kind === "damage-applied" && payload.targetKind === "party-member")
    )
      v.reference(
        catalog.data.characters,
        payload.targetId,
        "fact.payload.targetId",
      );
    if (f.kind === "healing-applied")
      v.reference(
        catalog.data.characters,
        payload.actorId,
        "fact.payload.actorId",
      );
    if (f.kind === "expedition-started") {
      v.reference(catalog.data.routes, payload.routeId, "fact.payload.routeId");
      for (const id of payload.partyIds as string[])
        v.reference(catalog.data.characters, id, "fact.payload.partyIds");
    }

    const vis = v.record(f.visibility, "visibility");
    const type = v.choice(
      vis.type,
      ["party", "player", "internal"],
      "visibility.type",
    );
    v.record(
      vis,
      "visibility",
      type === "party" ? ["type", "actorIds"] : ["type"],
    );
    if (type === "party")
      v.ids(vis.actorIds, "actorIds", 256).forEach((id) =>
        v.reference(catalog.data.characters, id, "actorIds"),
      );
    if (
      [
        "resource-changed",
        "save-created",
        "save-imported",
        "facts-retracted",
      ].includes(f.kind as string) &&
      type !== "internal"
    )
      v.invalid("visibility", "Internal fact cannot be made public");
  });
  if (seen.size !== referenced.size)
    v.invalid("facts", "Missing referenced facts");
  const retracted = v.ids(r.retractedFactIds, "retractedFactIds");
  const withdrawals = new Set<string>();
  for (const f of facts as GameRecord["facts"])
    if (f.kind === "facts-retracted")
      for (const id of (f.payload as { factIds: string[] }).factIds) {
        if (!seen.has(id) || referenced.get(id)!.revision >= f.source.revision)
          v.invalid("fact.payload.factIds", "Invalid withdrawal source");
        withdrawals.add(id);
      }
  if (
    retracted.some((id) => !withdrawals.has(id)) ||
    withdrawals.size !== retracted.length
  )
    v.invalid("retractedFactIds", "Withdrawal index differs from history");
  const anchors = v
    .list(r.undoAnchors, "undoAnchors", v.DATA_LIMITS.checkpoints)
    .map(historyRef);
  if (
    anchors.length !== (snapshot.expedition?.undoStack.length ?? 0) ||
    anchors.some((h, i) => i > 0 && h.revision < anchors[i - 1].revision)
  )
    v.invalid("undoAnchors", "Checkpoint source mismatch");
  if (snapshot.expedition?.lifecycle.type === "finished") {
    const p = v.record(r.pendingSettlement, "pendingSettlement", [
      "expeditionId",
      "terminalRef",
      "settlementId",
    ]);
    const terminal = historyRef(p.terminalRef);
    if (
      p.expeditionId !== snapshot.expedition.id ||
      p.settlementId !== settlementId(head, snapshot.expedition.id) ||
      !sameHead(terminal, head)
    )
      v.invalid("pendingSettlement", "Invalid terminal identity");
  } else if (r.pendingSettlement !== null)
    v.invalid("pendingSettlement", "Nonterminal state cannot settle");
  for (const entry of snapshot.campaign.appliedSettlements) {
    if (entry.id !== settlementId(head, entry.expeditionId))
      v.invalid("appliedSettlements", "Invalid settlement identity");
    if (
      !(facts as GameRecord["facts"]).some((f) => {
        if (
          f.kind !== "expedition-settled" ||
          f.expeditionId !== entry.expeditionId
        )
          return false;
        const { settlementId: id, ...result } = f.payload as Record<
          string,
          unknown
        >;
        return (
          id === entry.id &&
          v.canonicalJson(result) === v.canonicalJson(entry.result)
        );
      })
    )
      v.invalid("appliedSettlements", "Missing settlement fact");
  }
  return structuredClone(raw) as GameRecord;
}
