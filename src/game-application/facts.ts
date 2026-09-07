import * as v from "../game-core/contracts";
import type {
  BattleEvent,
  GameFact,
  GameRecord,
  HeadRef,
  JsonValue,
} from "./contracts";

export const FACT_KINDS = [
  "save-created",
  "save-imported",
  "expedition-started",
  "damage-applied",
  "healing-applied",
  "resource-changed",
  "layer-cleared",
  "expedition-finished",
  "expedition-settled",
  "facts-retracted",
] as const;
export const factId = (ref: HeadRef, index: number) =>
  `fact:${v.sha256(v.canonicalJson([ref, index]))}`;
export const settlementId = (ref: HeadRef, expeditionId: string) =>
  `settlement:${v.sha256(v.canonicalJson([ref.saveId, ref.epoch, expeditionId]))}`;
export function fact(
  record: GameRecord,
  kind: string,
  payload: JsonValue,
  index: number,
  internal = false,
): GameFact {
  return {
    version: 1,
    id: factId(record.head, index),
    source: { ...record.head },
    origin: "adventure",
    expeditionId: record.snapshot.expedition?.id ?? null,
    encounterId: record.snapshot.encounter?.id ?? null,
    worldTime: { ...record.snapshot.campaign.clock },
    kind,
    payload,
    visibility: internal
      ? { type: "internal" }
      : {
          type: "party",
          actorIds: record.snapshot.expedition?.party.map((p) => p.id) ?? [],
        },
  };
}
/** Explicit structured event mapping. Log text, RNG, intents and Catalog never cross this boundary. */
export function eventFacts(
  record: GameRecord,
  events: BattleEvent[],
): GameFact[] {
  const out: GameFact[] = [];
  for (const event of events) {
    const p = event.payload;
    switch (event.type) {
      case "damage-applied":
        if (
          event.payload.target.kind !== "enemy" &&
          event.payload.target.kind !== "party-member"
        )
          break;
        out.push(
          fact(
            record,
            event.type,
            {
              targetKind: event.payload.target.kind,
              targetId: event.payload.target.id,
              applied: event.payload.applied,
              hpAfter: event.payload.hpAfter,
            },
            out.length,
          ),
        );
        break;
      case "healing-applied":
        out.push(
          fact(
            record,
            event.type,
            {
              actorId: event.payload.actorId,
              targetId: event.payload.targetId,
              applied: event.payload.applied,
            },
            out.length,
          ),
        );
        break;
      case "resource-changed":
        out.push(
          fact(
            record,
            event.type,
            {
              resource: event.payload.resource,
              delta: event.payload.delta,
              after: event.payload.after,
            },
            out.length,
            true,
          ),
        );
        break;
      case "layer-cleared":
        out.push(
          fact(record, event.type, { layer: event.payload.layer }, out.length),
        );
        break;
      case "expedition-finished":
        out.push(
          fact(record, event.type, { ...event.payload.result }, out.length),
        );
        break;
      default:
        void p; // Unknown/unmapped events are deliberately not facts for this task.
    }
  }
  return out;
}
export function validateFactPayload(kind: unknown, payload: unknown): void {
  v.choice(kind, FACT_KINDS, "fact.kind");
  switch (kind) {
    case "save-created":
    case "save-imported": {
      const p = v.record(payload, "fact.payload", ["originRevision"]);
      if (p.originRevision !== null)
        v.number(p.originRevision, "originRevision");
      break;
    }
    case "expedition-started": {
      const p = v.record(payload, "fact.payload", ["routeId", "partyIds"]);
      v.id(p.routeId, "routeId");
      v.ids(p.partyIds, "partyIds", 256);
      break;
    }
    case "damage-applied": {
      const p = v.record(payload, "fact.payload", [
        "targetKind",
        "targetId",
        "applied",
        "hpAfter",
      ]);
      v.choice(p.targetKind, ["party-member", "enemy"], "targetKind");
      v.id(p.targetId, "targetId");
      v.number(p.applied, "applied");
      v.number(p.hpAfter, "hpAfter");
      break;
    }
    case "healing-applied": {
      const p = v.record(payload, "fact.payload", [
        "actorId",
        "targetId",
        "applied",
      ]);
      v.id(p.actorId, "actorId");
      v.id(p.targetId, "targetId");
      v.number(p.applied, "applied");
      break;
    }
    case "resource-changed": {
      const p = v.record(payload, "fact.payload", [
        "resource",
        "delta",
        "after",
      ]);
      v.choice(p.resource, ["gold", "bag-gold", "hand-multiplier"], "resource");
      v.number(
        p.delta,
        "delta",
        -Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        false,
      );
      v.number(p.after, "after", 0, Number.MAX_SAFE_INTEGER, false);
      break;
    }
    case "layer-cleared": {
      const p = v.record(payload, "fact.payload", ["layer"]);
      v.number(p.layer, "layer", 1);
      break;
    }
    case "expedition-finished":
    case "expedition-settled": {
      const p = v.record(payload, "fact.payload", [
        "wiped",
        "baseGold",
        "multiplier",
        "totalGold",
        "deepestLayer",
        "crystal",
        ...(kind === "expedition-settled" ? ["settlementId"] : []),
      ]);
      v.boolean(p.wiped, "wiped");
      v.boolean(p.crystal, "crystal");
      for (const k of ["baseGold", "totalGold", "deepestLayer"])
        v.number(p[k], k);
      v.number(p.multiplier, "multiplier", 0, 1e9, false);
      if (kind === "expedition-settled") v.id(p.settlementId, "settlementId");
      break;
    }
    case "facts-retracted": {
      const p = v.record(payload, "fact.payload", ["factIds"]);
      v.ids(p.factIds, "factIds");
      break;
    }
  }
}
export type ProjectedFact = Pick<GameFact, "id" | "kind" | "payload">;
export function projectFacts(
  record: GameRecord,
  actorIds: string[],
  source: HeadRef = record.head,
): ProjectedFact[] {
  const withdrawn = new Set(record.retractedFactIds);
  return record.facts
    .filter(
      (f) =>
        f.origin !== "simulation" &&
        f.source.saveId === source.saveId &&
        f.source.epoch === source.epoch &&
        f.source.revision === source.revision &&
        !withdrawn.has(f.id) &&
        FACT_KINDS.includes(f.kind as (typeof FACT_KINDS)[number]) &&
        f.visibility.type === "party" &&
        actorIds.length > 0 &&
        actorIds.every(
          (id) =>
            f.visibility.type === "party" && f.visibility.actorIds.includes(id),
        ),
    )
    .map((f) => ({
      id: f.id,
      kind: f.kind,
      payload: structuredClone(f.payload),
    }));
}
