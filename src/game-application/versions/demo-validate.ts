import * as v from "../../game-core/contracts";
import type { ValidatedDemoCatalog } from "../../game-core/contracts";
import { validateTerminal, parseDemoItemTarget, validateDemoSnapshot } from "../../game-core/session";
import type { JsonValue } from "../../game-core/battle";
import { parseHead } from "../parse";
import { sameHead } from "../transaction";
import type { DemoGameRecord, DemoReceipt } from "./demo-contracts";

export function validateDemoReceipt(
  raw: unknown,
  catalog: ValidatedDemoCatalog,
): DemoReceipt {
  v.assertJson(raw);
  const r = v.record(raw, "receipt", [
    "version",
    "contentRef",
    "saveId",
    "epoch",
    "requestId",
    "fingerprint",
    "status",
    "before",
    "after",
    "error",
    "events",
    "factIds",
  ]);
  v.choice(r.version, [catalog.ref.rulesVersion], "receipt.version");
  if (v.canonicalJson(r.contentRef) !== v.canonicalJson(catalog.ref))
    v.invalid(
      "receipt.contentRef",
      "Receipt content differs",
      "content-mismatch",
    );
  const saveId = v.id(r.saveId, "receipt.saveId"),
    epoch = v.id(r.epoch, "receipt.epoch");
  v.id(r.requestId, "receipt.requestId");
  if (!/^[a-f0-9]{64}$/.test(v.text(r.fingerprint, "fingerprint", 64)))
    v.invalid("fingerprint", "Invalid request digest");
  const status = v.choice(
    r.status,
    ["committed", "rejected"],
    "receipt.status",
  );
  for (const rawHead of [r.before, r.after])
    if (rawHead !== null) {
      const head = parseHead(rawHead);
      if (
        head.saveId !== saveId ||
        (status === "committed" && head.epoch !== epoch)
      )
        v.invalid("receipt.head", "Receipt identity differs");
    }
  if (
    status === "committed"
      ? r.error !== null || r.after === null
      : r.error === null ||
        !sameHead(
          r.before === null ? null : parseHead(r.before),
          r.after === null ? null : parseHead(r.after),
        )
  )
    v.invalid("receipt", "Status and heads differ");
  if (r.error !== null) {
    const error = v.record(r.error, "error", ["code", "path", "message"]);
    v.id(error.code, "error.code");
    v.text(error.path, "error.path");
    v.text(error.message, "error.message");
  }
  const events = v.list(r.events, "events", 256);
  const eventIds = new Set<string>();
  for (const raw of events) {
    const e = v.record(raw, "event", ["id", "type", "actorId", "payload"]),
      id = v.id(e.id, "event.id"),
      type = v.id(e.type, "event.type");
    if (eventIds.has(id)) v.invalid("events", "Duplicate event identity");
    eventIds.add(id);
    if (e.actorId !== null) v.id(e.actorId, "event.actorId");
    if (Object.hasOwn(demoFactFields(catalog.ref.rulesVersion), type))
      validateDemoFactPayload(type, e.payload, catalog.ref.rulesVersion);
    else {
      const keys: Record<string, string[]> = {
        "dice-rolled": ["ownerIds", "reroll"],
        "die-fixed": ["loaded"],
        "action-resolved": ["actionId", "choice", "targetId"],
        "action-undone": [],
        "hand-settled": ["name", "bonus", "wildValue"],
        "enemy-intent-resolved": ["skipped", "cursor"],
        "seal-scheduled": ["targetId"],
        "round-started": ["round"],
        "encounter-started": ["encounterId", "layer", "room"],
      };
      if (!Object.hasOwn(keys, type))
        v.invalid("event.type", "Unsupported event");
      const payload = v.record(e.payload, "event.payload", keys[type]);
      if (type === "action-undone" && Object.keys(payload).length)
        v.invalid("payload", "Expected empty payload");
    }
  }
  const factIds = v.ids(r.factIds, "factIds");
  if (status === "rejected" && (events.length || factIds.length))
    v.invalid("receipt", "Rejected receipt contains effects");
  return structuredClone(raw) as DemoReceipt;
}

export const demoFactId = (
  saveId: string,
  epoch: string,
  revision: number,
  index: number,
) => `fact:${v.sha256(v.canonicalJson([saveId, epoch, revision, index]))}`;
export const DEMO_FACT_FIELDS: Record<string, string[]> = {
  "round-started": ["round"],
  "encounter-started": ["encounterId", "layer", "room"],
  "seal-scheduled": ["targetId"],
  "save-created": ["profileId"],
  "save-imported": ["originRevision"],
  "expedition-started": ["runId", "routeId", "partyIds"],
  "enemy-repaired": ["targetId", "applied", "hpAfter"],
  "room-completed": ["roomId", "layer"],
  "event-resolved": ["roomId", "eventId", "choiceId", "actorId", "faceId", "method", "cost", "reward"],
  "layer-banked": ["layer", "roomId", "looseGold", "handBonusPercent", "depthPercent", "earthPercent", "gold"],
  "information-revealed": ["targetId", "roomId"],
  "item-used": ["instanceId", "definitionId", "roomId", "target", "remaining"],
  "expedition-finished": ["id", "runId", "routeId", "outcome", "deepestLayer", "partyIds", "bankedGold", "lostLooseGold", "lostBankedGold", "totalGold", "returnedSupplies", "layerResults"],
  "expedition-settled": ["id", "runId", "routeId", "outcome", "deepestLayer", "partyIds", "bankedGold", "lostLooseGold", "lostBankedGold", "totalGold", "returnedSupplies", "layerResults"],
  "damage-applied": ["targetKind", "targetId", "applied", "hpAfter"],
  "healing-applied": ["targetId", "applied", "hpAfter"],
  "enemy-defeated": ["targetId", "bounty"],
  "unit-downed": ["faceId"],
  "healing-cost": ["cost"],
  "thread-bound": ["targetId", "stunned"],
  "thread-consumed": ["targetId"],
  "guard-applied": ["enemyId", "targetId", "amount"],
  "covenant-triggered": ["covenantId", "stage"],
  "status-cleansed": ["targetId", "statusId"],
  "encounter-completed": ["outcome", "encounterId"],
  "facts-retracted": ["factIds"],
};
const MANOR_FACT_FIELDS: Record<string, string[]> = {
  ...DEMO_FACT_FIELDS,
  "expedition-finished": [...DEMO_FACT_FIELDS["expedition-finished"], "completion"],
  "expedition-settled": [...DEMO_FACT_FIELDS["expedition-settled"], "completion"],
  "banquet-seats-changed": ["encounterId", "reason", "targetId", "before", "after", "toastPower"],
  "enemy-summoned": ["targetId", "definitionId", "bornRound", "serial"],
  "enemy-released": ["targetId", "bounty", "reason"],
  "manor-program-stopped": ["terminalId", "runId", "routeId", "roomIds", "encounterIds"],
  "manor-takeover-completed": ["progressId", "terminalId", "runId"],
  "reward-granted": ["rewardId", "terminalId", "gold"],
  "story-acknowledged": ["terminalId", "step", "status"],
};
export const demoFactFields = (version: 2 | 3) => version === 3 ? MANOR_FACT_FIELDS : DEMO_FACT_FIELDS;
export function validateDemoFactPayload(kind: string, raw: unknown, version: 2 | 3 = 2): JsonValue {
  const fields = demoFactFields(version);
  if (!Object.hasOwn(fields, kind))
    v.invalid("fact.kind", "Unsupported fact kind");
  const p = v.record(raw, "fact.payload", fields[kind]);
  for (const [key, value] of Object.entries(p)) {
    if (
      [
        "applied",
        "hpAfter",
        "bounty",
        "cost",
        "amount",
        "originRevision", "layer", "room", "round", "reward", "looseGold", "handBonusPercent", "depthPercent", "earthPercent", "gold", "remaining", "deepestLayer", "bankedGold", "lostLooseGold", "lostBankedGold", "totalGold", "before", "after", "toastPower", "bornRound", "serial", "step",
      ].includes(key)
    )
      v.number(value, key, 0, 1e9);
    else if (key === "stage") v.choice(value, [1, 2], key);
    else if (key === "stunned") v.boolean(value, key);
    else if (key === "outcome") v.choice(value, ["victory", "wipe", "extracted", ...(version === 3 ? ["cleared"] : [])], key);
    else if (key === "reason") v.choice(value, kind === "enemy-released" ? ["core-released"] : ["defeated", "summoned", "released"], key);
    else if (key === "status") v.choice(value, ["pending", "viewed", "skipped"], key);
    else if (key === "completion") {
      if (value !== null) {const c = v.record(value, "completion", ["roomIds", "encounterIds"]); v.ids(c.roomIds, "roomIds", 100); v.ids(c.encounterIds, "encounterIds", 20);}
    }
    else if (key === "targetKind")
      v.choice(value, ["enemy", "party-member"], key);
    else if (["factIds", "partyIds", "roomIds", "encounterIds"].includes(key)) v.ids(value, key);
    else if (key === "target") parseDemoItemTarget(value);
    else if (key === "returnedSupplies" || key === "layerResults") v.list(value, key, 7);
    else if (key === "choiceId") v.choice(value, ["read", "attempt", "skip"], key);
    else if (key === "method") v.choice(value, ["read", "skip", "strong", "weak", "failed"], key);
    else if (["faceId", "actorId"].includes(key) && value === null) continue;
    else v.id(value, key);
  }
  return raw as JsonValue;
}
export function validateDemoRecord(
  raw: unknown,
  catalog: ValidatedDemoCatalog,
): DemoGameRecord {
  v.assertJson(raw);
  const r = v.record(raw, "record", [
    "schemaVersion",
    "head",
    "contentRef",
    "profileId",
    "snapshot",
    "commits",
    "facts",
    "retractedFactIds",
    "undoAnchors",
    "originRef",
  ]);
  v.choice(r.schemaVersion, [catalog.ref.rulesVersion], "schemaVersion");
  if (v.canonicalJson(r.contentRef) !== v.canonicalJson(catalog.ref))
    v.invalid("contentRef", "Catalog identity differs", "content-mismatch");
  const head = parseHead(r.head),
    profileId = v.id(r.profileId, "profileId");
  const snapshot = validateDemoSnapshot(catalog, profileId, r.snapshot);
  const ownHead = (raw: unknown) => {
    const ref = parseHead(raw);
    if (
      ref.saveId !== head.saveId ||
      ref.epoch !== head.epoch ||
      ref.revision > head.revision
    )
      v.invalid("head", "Foreign history reference");
    return ref;
  };
  if (r.originRef !== null) parseHead(r.originRef);
  const commits = v.list(r.commits, "commits"),
    requests = new Set<string>(),
    factRefs = new Map<string, number>();
  if (commits.length !== head.revision + 1)
    v.invalid("commits", "Broken history");
  commits.forEach((raw, i) => {
    const c = v.record(raw, "commit", [
        "ref",
        "previous",
        "requestId",
        "kind",
        "factIds",
      ]),
      ref = ownHead(c.ref);
    if (
      ref.revision !== i ||
      !sameHead(
        c.previous === null ? null : ownHead(c.previous),
        i ? { ...head, revision: i - 1 } : null,
      )
    )
      v.invalid("commit", "Broken chain");
    const requestId = v.id(c.requestId, "requestId");
    if (requests.has(requestId)) v.invalid("commit", "Duplicate request");
    requests.add(requestId);
    v.choice(
      c.kind,
      [
        "create",
        "import",
        "start-expedition",
        "battle-command",
        "undo",
        "resume-run", "advance-room", "choose-event", "choose-exit", "use-item", "settle-expedition", ...(catalog.ref.rulesVersion === 3 ? ["acknowledge-story"] : []),
      ],
      "commit.kind",
    );
    v.ids(c.factIds, "factIds").forEach((id, index) => {
      if (
        id !== demoFactId(head.saveId, head.epoch, i, index) ||
        factRefs.has(id)
      )
        v.invalid("factId", "Invalid fact identity");
      factRefs.set(id, i);
    });
  });
  const seen = new Set<string>(),
    retractionClaims = new Set<string>();
  const factsById = new Map(
    v.list(r.facts, "facts").map((raw) => {
      const f = v.record(raw, "fact");
      return [v.id(f.id, "fact.id"), f];
    }),
  );
  for (const raw of v.list(r.facts, "facts")) {
    const f = v.record(raw, "fact", [
      "version",
      "id",
      "source",
      "originRef",
      "origin",
      "runRef",
      "encounterId",
      "worldTime",
      "kind",
      "actorId",
      "payload",
      "visibility",
    ]);
    v.choice(f.version, [catalog.ref.rulesVersion], "fact.version");
    const id = v.id(f.id, "fact.id"),
      source = ownHead(f.source);
    if (seen.has(id) || factRefs.get(id) !== source.revision)
      v.invalid("fact", "Unbound fact");
    seen.add(id);
    if (f.originRef !== null) parseHead(f.originRef);
    v.choice(f.origin, ["adventure", "simulation"], "origin");
    v.choice(f.visibility, ["party", "internal"], "visibility");
    if (f.actorId !== null) v.id(f.actorId, "actorId");
    let runId: string | null = null;
    if (f.runRef !== null) {
      const ref = v.record(f.runRef, "fact.runRef", ["kind", "id"]);
      v.choice(ref.kind, ["expedition"], "kind");
      runId = v.id(ref.id, "run.id");
    }
    if (
      f.encounterId !== null &&
      (!runId ||
        !v.id(f.encounterId, "encounterId").startsWith(`${runId}:encounter:`))
    )
      v.invalid("fact.encounterId", "Encounter outside run");
    const time = v.record(f.worldTime, "worldTime", ["day", "phase"]);
    v.number(time.day, "day", 1);
    v.choice(time.phase, ["dawn", "day", "dusk", "night"], "phase");
    const payload = validateDemoFactPayload(
      v.id(f.kind, "fact.kind"),
      f.payload, catalog.ref.rulesVersion,
    ) as Record<string, JsonValue>;
    const member = (id: unknown) =>
      v.reference(catalog.data.characters, id, "fact.character");
    const enemy = (id: unknown) => {
      if (
        !f.encounterId ||
        !v.id(id, "fact.enemy").startsWith(`${f.encounterId}:enemy:`)
      )
        v.invalid("fact.enemy", "Enemy outside encounter");
    };
    if (f.actorId !== null) {
      if (
        typeof f.actorId === "string" &&
        f.actorId.startsWith(`${f.encounterId}:enemy:`)
      )
        enemy(f.actorId);
      else member(f.actorId);
    }
    if (f.kind === "damage-applied") {
      if (payload.targetKind === "enemy") enemy(payload.targetId);
      else member(payload.targetId);
    }
    if (
      ["enemy-defeated", "thread-bound", "thread-consumed", "enemy-repaired", "enemy-summoned", "enemy-released", "banquet-seats-changed"].includes(
        f.kind as string,
      )
    )
      enemy(payload.targetId);
    if (
      ["healing-applied", "status-cleansed", "guard-applied"].includes(
        f.kind as string,
      )
    )
      member(payload.targetId);
    if (f.kind === "guard-applied") enemy(payload.enemyId);
    if (catalog.ref.rulesVersion === 3) {
      const spec = catalog.data.manor!;
      if (f.kind === "enemy-summoned") {
        if (payload.definitionId !== spec.boss.guestId || !f.actorId || payload.targetId !== `${f.encounterId}:enemy:summon:${payload.serial}`) v.invalid("summon.fact", "Invalid summoned instance");
        enemy(f.actorId); v.number(payload.serial, "serial", 1, spec.boss.summonBudget); v.number(payload.bornRound, "bornRound", 1);
      }
      if (f.kind === "banquet-seats-changed") {
        v.number(payload.before, "before", 0, spec.boss.maxGuests); v.number(payload.after, "after", 0, spec.boss.maxGuests);
        if (payload.encounterId !== f.encounterId || payload.toastPower !== 2 + (payload.after as number) || (payload.reason === "summoned" ? payload.after !== (payload.before as number) + 1 : payload.reason === "defeated" ? payload.after !== (payload.before as number) - 1 : payload.after !== 0)) v.invalid("seats.fact", "Invalid seat delta");
      }
      if (f.kind === "enemy-released" && payload.bounty !== 0 && payload.bounty !== catalog.data.enemies[spec.boss.definitionId].bounty) v.invalid("release.fact", "Unexpected release bounty");
      if (f.kind === "story-acknowledged") v.number(payload.step, "step", 0, 4);
    }
    if (f.kind === "status-cleansed")
      v.choice(payload.statusId, ["status.sealed"], "statusId");
    if (
      f.kind === "unit-downed" &&
      payload.faceId !== null &&
      !member(f.actorId).faces.some((face) => face.id === payload.faceId)
    )
      v.invalid("fact.faceId", "Face outside owner");
    if (f.kind === "covenant-triggered") {
      v.reference(catalog.data.covenants, payload.covenantId, "covenantId");
      if (member(f.actorId).covenantId !== payload.covenantId)
        v.invalid("fact.covenant", "Covenant outside owner");
    }
    if (
      f.kind === "encounter-completed" &&
      payload.encounterId !== f.encounterId
    )
      v.invalid("fact.encounterId", "Completion identity differs");
    if (["expedition-finished", "expedition-settled"].includes(f.kind as string)) {
      validateTerminal(catalog, payload);
      if (payload.runId !== runId) v.invalid("fact.runRef", "Terminal run differs");
    }
    if (payload.roomId !== undefined && (!runId || !v.id(payload.roomId, "roomId").startsWith(`${runId}:room:`))) v.invalid("fact.roomId", "Room outside run");
    if (f.kind === "expedition-started") {
      v.reference(catalog.data.routes, payload.routeId, "fact.routeId");
      (payload.partyIds as string[]).forEach(member);
    }
    if (f.kind === "expedition-started" && payload.runId !== runId)
      v.invalid("fact.runRef", "Started run differs");
    if (f.kind === "facts-retracted")
      for (const id of payload.factIds as string[]) {
        const target = factsById.get(id);
        if (
          !target ||
          retractionClaims.has(id) ||
          parseHead(target.source).revision >= source.revision ||
          [
            "save-created",
            "save-imported",
            "expedition-started",
            "facts-retracted",
          ].includes(target.kind as string) ||
          v.canonicalJson(target.runRef) !== v.canonicalJson(f.runRef)
        )
          v.invalid("fact.retraction", "Invalid retraction target");
        retractionClaims.add(id);
      }
  }
  if (seen.size !== factRefs.size) v.invalid("facts", "Missing fact");
  const retracted = v.ids(r.retractedFactIds, "retractedFactIds");
  retracted.forEach((id) => {
    if (!seen.has(id)) v.invalid("retractedFactIds", "Unknown fact");
  });
  if (
    v.canonicalJson([...retracted].sort()) !==
    v.canonicalJson([...retractionClaims].sort())
  )
    v.invalid(
      "retractedFactIds",
      "Retraction ledger differs from committed facts",
    );
  const anchors = v.list(r.undoAnchors, "undoAnchors", 256);
  anchors.forEach(ownHead);
  if (anchors.length !== (snapshot.expedition?.undo.length ?? 0))
    v.invalid("undoAnchors", "Checkpoint mismatch");
  if (catalog.ref.rulesVersion === 3) validateManorHistory(raw as DemoGameRecord);
  return structuredClone(raw) as DemoGameRecord;
}
import { validateManorHistory } from "./manor-history";
