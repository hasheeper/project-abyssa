import { d5EncounterView, d5MemoryView, d5ProgressionView } from "./d5-views";
import { createD5MemoryEngine, createD5BattleEngine, resolveDemoCharacter } from "../game-core/battle";
import type { D5Request, D5Command } from "../game-application";
import { parseD5Request } from "../game-application";
import * as v from "../game-core/contracts";
import {
  createBattleEngine,
  createDemoBattleEngine,
  resolveDemoParty,
} from "../game-core/battle";
import { activeExecution, demoCharacterView, asDemoBattle, layerReady, routeComplete } from "../game-core/session";
import type {
  AnyGameRecord,
  CommandRequest,
  DemoCommand,
  DemoRequest,
  GameCommand,
} from "../game-application";
import { parseDemoRequest, projectPlayerHistory } from "../game-application";
import { parseCommandRequest } from "../game-application/parse";
import type { CatalogRegistry } from "./catalogs";
import { createCharacterArchiveQuery } from "./character-views";
import { demoJourneyView, d5JourneyView } from "./demo-journey-view";

export function parseVersionedRequest(
  raw: unknown,
  internal = false,
): CommandRequest | DemoRequest | D5Request {
  v.assertJson(raw);
  const envelope = v.record(raw, "request");
  if (envelope.protocolVersion === 4) return parseD5Request(raw, internal);
  if (envelope.protocolVersion === 1) return parseCommandRequest(raw, internal);
  if (envelope.protocolVersion === 2 || envelope.protocolVersion === 3) return parseDemoRequest(raw, internal, envelope.protocolVersion);
  return v.invalid(
    "protocolVersion",
    "Unsupported protocol",
    "unsupported-schema",
  );
}
export function createVersionedQueries(registry: CatalogRegistry) {
  const journeyCache = new WeakMap<AnyGameRecord, ReturnType<typeof demoJourneyView>>();
  return {
    archive: createCharacterArchiveQuery(registry),
    shop(raw: AnyGameRecord) {
      const record = registry.read(raw), entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (record.schemaVersion !== 4 || entry.version !== 4 || !entry.catalog.data.economy) return null;
      const c = record.snapshot.campaign, e = entry.catalog.data.economy;
      return {shopId: e.shopId, quoteVersion: e.quoteVersion, funds: c.funds.party, crystals: c.funds.crystals,
        available: !c.activeRunRef && !c.activeStoryId,
        products: Object.entries(e.prices).map(([id, price]) => ({...entry.catalog.data.journey!.items[id], price, stored: c.supplies.find(s => s.definitionId === id)?.charges ?? 0}))};
    },
    memory(raw: AnyGameRecord) { const record = registry.read(raw); return record.schemaVersion === 4 ? d5MemoryView(record) : null; },
    progression(raw: AnyGameRecord) {
      const record = registry.read(raw), entry = registry.resolve(record.schemaVersion, record.contentRef);
      return record.schemaVersion === 4 && entry.version === 4 ? d5ProgressionView(entry.catalog, record) : null;
    },
    journey(raw: AnyGameRecord) {
      const record = registry.read(raw), entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (journeyCache.has(record)) return journeyCache.get(record)!;
      const view = record.schemaVersion === 4 && entry.version === 4 ? d5JourneyView(entry.catalog, record) : record.schemaVersion !== 1 && record.schemaVersion !== 4 && entry.version !== 1 && entry.version !== 4 ? demoJourneyView(entry.catalog, record) : null;
      journeyCache.set(record, view);
      return view;
    },
    character(raw: AnyGameRecord, id: string) {
      const record = registry.read(raw),
        entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (entry.version !== 1 && record.schemaVersion !== 1) {
        const member = record.schemaVersion === 4 ? d5EncounterView(record)?.run.party.find(m => m.id === id) : null;
        const view = record.schemaVersion === 4 && entry.version === 4 ? { available: record.snapshot.campaign.availableCharacterIds.includes(id), inRun: !!member, config: member?.config ?? resolveDemoCharacter(entry.catalog.data, record.snapshot.campaign.progress, id), temporaryRust: member?.temporaryRust ?? [] }
          : record.schemaVersion !== 4 && entry.version !== 4 ? demoCharacterView(entry.catalog, record.profileId, record.snapshot, id) : v.invalid("version", "Version mismatch");
        return {
          version: 2 as const,
          head: record.head,
          contentRef: record.contentRef,
          ...view,
          nextLevel:
            view.config.level < 3 && id !== entry.catalog.data.leaderId
              ? view.config.level + 1
              : null,
          equipmentSlots: {
            general: entry.catalog.data.characters[id].faces.some(
              (f) => entry.catalog.data.actions[f.actionId].kind === "blank",
            ),
            exclusive: false,
            accessory: false,
          },
          covenantExecutable:
            view.config.covenantId !== null &&
            (!!entry.catalog.data.covenants[view.config.covenantId] || entry.version === 4 && view.config.covenantId === "covenant.marietta"),
        };
      }
      if (entry.version === 1)
        return {
          version: 1 as const,
          head: record.head,
          contentRef: record.contentRef,
          definition: v.reference(
            entry.catalog.data.characters,
            id,
            "characterId",
          ),
        };
      return v.invalid("version", "Version mismatch");
    },
    party(raw: AnyGameRecord, partyIds?: string[]) {
      const record = registry.read(raw),
        entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (entry.version !== 1 && record.schemaVersion !== 1) {
        const profile = entry.catalog.data.profiles[record.profileId],
          battle = record.schemaVersion === 4 ? d5EncounterView(record) : record.snapshot.expedition;
        const ids = battle
          ? battle.run.party.map((m) => m.id)
          : (partyIds ?? entry.catalog.data.initialParty);
        ids.forEach((id) => {
          if (!(record.schemaVersion === 4 ? record.snapshot.campaign.availableCharacterIds : profile.availableCharacterIds).includes(id))
            v.invalid("party", "Unavailable character");
        });
        return {
          version: 2 as const,
          head: record.head,
          contentRef: record.contentRef,
          availableCharacterIds: record.schemaVersion === 4 ? record.snapshot.campaign.availableCharacterIds : profile.availableCharacterIds,
          inRun: !!battle,
          ...resolveDemoParty(
            entry.catalog.data,
            battle?.run.progress ?? record.snapshot.campaign.progress,
            ids,
          ),
        };
      }
      if (entry.version === 1)
        return {
          version: 1 as const,
          head: record.head,
          contentRef: record.contentRef,
          definitions: entry.catalog.data.characters,
        };
      return v.invalid("version", "Version mismatch");
    },
    battle(raw: AnyGameRecord) {
      const record = registry.read(raw),
        entry = registry.resolve(record.schemaVersion, record.contentRef);
      if (entry.version === 4 && record.schemaVersion === 4) {
        const run = record.snapshot.run;
        const selected = run?.kind === "memory" && run.battle ? createD5MemoryEngine(entry.catalog).select(run.battle) : run?.kind === "expedition" && run.state.node === "battle" ? createD5BattleEngine(entry.catalog).select(asDemoBattle(run.state)!) : null;
        return selected ? { version: 2 as const, head: record.head, ...selected, settledHand: d5EncounterView(record)!.encounter!.hand } : null;
      }
      if (entry.version !== 1 && entry.version !== 4 && record.schemaVersion !== 1 && record.schemaVersion !== 4)
        return record.snapshot.expedition?.node === "battle"
          ? {
              version: 2 as const,
              head: record.head,
              ...createDemoBattleEngine(entry.catalog).select(
                asDemoBattle(record.snapshot.expedition)!,
              ),
              settledHand: record.snapshot.expedition.encounter.hand,
            }
          : null;
      if (entry.version === 1 && record.schemaVersion === 1)
        return record.snapshot.expedition
          ? {
              version: 1 as const,
              head: record.head,
              view: createBattleEngine(
                entry.catalog,
                record.snapshot.expedition.routeId,
              ).select(activeExecution(record.snapshot)),
            }
          : null;
      return v.invalid("version", "Version mismatch");
    },
    continuation(raw: AnyGameRecord): CommandRequest | DemoRequest | D5Request | null {
      const record = registry.read(raw),
        entry = registry.resolve(record.schemaVersion, record.contentRef);
      let command: GameCommand | DemoCommand | D5Command | null = null;
      if (entry.version === 4 && record.schemaVersion === 4) {
        const run = record.snapshot.run;
        if (run?.kind === "memory" && run.battle && record.snapshot.campaign.memory?.node === "battle") {
          const e = run.battle.encounter;
          if (e.phase === "enemy" || e.phase === "act" && e.memory?.defeated) command = {type: "resume-run", runRef: {kind: "memory", id: run.id, attempt: run.attempt}};
        } else if (run?.kind === "expedition") {
          const e = run.state.encounter, runRef = {kind: "expedition" as const, id: run.id};
          if (e && (e.phase === "enemy" || e.phase === "complete" || e.phase === "act" && !e.formation.length) || layerReady(entry.catalog.data, run.state) || routeComplete(entry.catalog.data, run.state)) command = {type: "resume-run", runRef};
          else if (run.state.node === "finished" && run.state.result.outcome === "cleared") command = {type: "settle-expedition", runRef, terminalRef: run.state.result.id};
        }
      } else if (
        entry.version !== 1 && entry.version !== 4 &&
        record.schemaVersion !== 1 && record.schemaVersion !== 4 &&
        record.snapshot.expedition
      ) {
        const expedition = record.snapshot.expedition;
        const e = expedition.encounter, runRef = {kind: "expedition" as const, id: expedition.run.id};
        if (e && (e.phase === "enemy" || e.phase === "complete" || e.phase === "act" && !e.formation.length) || layerReady(entry.catalog.data, expedition) || routeComplete(entry.catalog.data, expedition)) command = {type: "resume-run", runRef};
        else if (expedition.node === "finished" && expedition.result.outcome === "cleared") command = {type: "settle-expedition", runRef, terminalRef: expedition.result.id};
      } else if (
        entry.version === 1 &&
        record.schemaVersion === 1 &&
        record.snapshot.expedition?.lifecycle.type === "in-encounter"
      ) {
        const expeditionId = record.snapshot.expedition.id,
          state = activeExecution(record.snapshot),
          engine = createBattleEngine(
            entry.catalog,
            record.snapshot.expedition.routeId,
          );
        if (state.mode.type === "enemy-turn") {
          if (state.mode.outcome === null)
            command = { type: "resume-enemy-turn", expeditionId };
          else if (state.mode.outcome === "continue")
            command = {
              type: "battle-command",
              expeditionId,
              command: { type: "next-round" },
            };
        } else if (
          state.mode.type === "player-turn" &&
          engine.select(state).outcome === "layer-cleared"
        )
          command = {
            type: "battle-command",
            expeditionId,
            command: { type: "end-turn" },
          };
      }
      return command
        ? parseVersionedRequest(
            {
              protocolVersion: record.schemaVersion,
              saveId: record.head.saveId,
              expectedHead: record.head,
              clientRequestId: `resume:${v.sha256(v.canonicalJson([record.contentRef, record.head, command]))}`,
              command,
            },
            ["resume-run", "resume-enemy-turn"].includes(command.type),
          )
        : null;
    },
    history(raw: AnyGameRecord, runId?: string) {
      const record = registry.read(raw);
      if (record.schemaVersion === 1) {
        const id = runId ?? record.snapshot.campaign.activeExpeditionId;
        return {
          version: 1 as const,
          history: id ? projectPlayerHistory(record, id) : [],
        };
      }
      const id = runId ?? record.snapshot.campaign.activeRunRef?.id;
      return {
        version: 2 as const,
        facts: record.facts
          .filter(
            (f) =>
              f.visibility === "party" &&
              f.origin === "adventure" &&
              f.runRef?.id === id &&
              !record.retractedFactIds.includes(f.id),
          )
          .map((f) => structuredClone(f)),
      };
    },
  };
}
