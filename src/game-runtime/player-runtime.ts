import { D5_FOUNDATION_CATALOG } from "./d5-foundation";
import { LOOP_CATALOG } from "./loop-context";
import { FIRST_MORNING_CATALOG, FIRST_MORNING_V1_CATALOG } from "./first-morning-context";
import { PROLOGUE_CATALOG } from "./prologue-context";
import { FULL_MANOR_CATALOG } from "./full-manor-context";
import type { GameRecord, CommandReceipt, GameStorePort, VersionedGameStore, AnyGameRecord, ReceiptError } from "../game-application";
import { applicationError } from "../game-application";
import * as v from "../game-core/contracts";
import { MANOR_CATALOG } from "./manor-context";
import { createVersionedGameRuntime } from "./versioned-runtime";
import { LEGACY_VALIDATED_CATALOG } from "./legacy-context";
import { createGameRuntime } from "./create-runtime";

export type PlayerSaveListEntry = {status: "ready"; saveId: string; summary: {head: AnyGameRecord["head"]; contentRef: AnyGameRecord["contentRef"]; activeExpeditionId: string | null; supersedes?: AnyGameRecord["head"]; continuation?: {upgrade:boolean;cycle:boolean}}; clock: AnyGameRecord["snapshot"]["campaign"]["clock"]} | {status: "unavailable"; saveId: string; error: ReceiptError};
export const PLAYER_CATALOGS = [{version: 1 as const, catalog: LEGACY_VALIDATED_CATALOG}, {version: 2 as const, catalog: MANOR_CATALOG}, {version: 3 as const, catalog: FULL_MANOR_CATALOG}, {version: 4 as const, catalog: D5_FOUNDATION_CATALOG}, {version: 4 as const, catalog: LOOP_CATALOG}, {version: 4 as const, catalog: PROLOGUE_CATALOG}, {version: 4 as const, catalog: FIRST_MORNING_V1_CATALOG}, {version: 4 as const, catalog: FIRST_MORNING_CATALOG}];
export function createPlayerRuntime(store: VersionedGameStore, environment: {newId: () => string; newSeed: () => number; close: () => void}) {
  const runtime = createVersionedGameRuntime(store, PLAYER_CATALOGS);
  const legacyStore: GameStorePort = {
    async read(id) { const r = await store.read(id); if (r && r.schemaVersion !== 1) v.invalid("record", "Not a legacy save"); return r as GameRecord | null; },
    listSaveIds: () => store.listSaveIds(),
    async receipt(...args) { const r = await store.receipt(...args); if (r && r.version !== 1) v.invalid("receipt", "Not a legacy receipt"); return r as CommandReceipt | null; },
    async commit(p) { const r = await store.commit(p); if (r.receipt.version !== 1) v.invalid("receipt", "Not a legacy receipt"); return {...r, receipt: r.receipt}; },
  };
  const legacy = createGameRuntime(legacyStore, environment);
  return {
    ...environment,
    defaultCreation: {protocolVersion: 4 as const, contentVersion: 6 as const, profileId: "profile.demo.first-run"},
    queries: runtime.queries,
    createReactions: legacy.createReactions,
    close: legacy.close,
    application: {
      ...runtime,
      resumeEnemyTurn: runtime.resume,
      async list() {
        const result = await runtime.list(); if (!result.ok) return result;
        const saves: PlayerSaveListEntry[] = result.saves.map(s => s.status === "unavailable" ? s : {status: "ready", saveId: s.saveId, summary: {head: s.head, contentRef: s.contentRef, activeExpeditionId: s.activeRunId, supersedes:s.supersedes, continuation:s.continuation}, clock: s.clock});
        return {ok: true as const, saves};
      },
      async create(raw: unknown) {
        try {
          const request = v.record(raw, "create");
          if (request.protocolVersion === 4 && (request.contentVersion === 3 || request.contentVersion === 4 || request.contentVersion === 5 || request.contentVersion === 6)) {
            const {contentVersion: _, ...inner} = request;
            return runtime.create({contentRef: request.contentVersion === 6 ? FIRST_MORNING_CATALOG.ref : request.contentVersion === 5 ? FIRST_MORNING_V1_CATALOG.ref : request.contentVersion === 4 ? PROLOGUE_CATALOG.ref : LOOP_CATALOG.ref, request: inner});
          }
          return runtime.create({contentRef: request.protocolVersion === 4 ? D5_FOUNDATION_CATALOG.ref : request.protocolVersion === 3 ? FULL_MANOR_CATALOG.ref : request.protocolVersion === 2 ? MANOR_CATALOG.ref : LEGACY_VALIDATED_CATALOG.ref, request});
        } catch (e) { return {ok: false as const, error: applicationError(e)}; }
      },
      continueSave(raw: {sourceSaveId:string;expectedSourceHead:AnyGameRecord["head"];saveId:string;epoch:string;clientRequestId:string;kind:"upgrade"|"cycle"}) {
        return runtime.continueSave({...raw,contentRef:FIRST_MORNING_CATALOG.ref});
      },
      /** Resume an append-only opening in a new proven save; deterministic identity makes retry/two tabs idempotent. */
      async extendOpening(sourceSaveId:string,expectedSourceHead:AnyGameRecord["head"],consumeLastPage=false) {
        const source=await runtime.open(sourceSaveId);
        if(!source.ok) return source;
        if(source.record.schemaVersion!==4 || source.record.contentRef.contentVersion!==5 || !source.record.snapshot.campaign.opening || source.record.snapshot.campaign.opening.status==="skipped")
          return {ok:false as const,error:applicationError(new v.DataValidationError("content-unavailable","opening","Only the original first morning can extend"))};
        if(consumeLastPage && (source.record.snapshot.campaign.opening.status!=="playing" || source.record.snapshot.campaign.opening.step!==66))
          return {ok:false as const,error:applicationError(new v.DataValidationError("command-not-available","opening","Only the final S1 page can advance into S2"))};
        const id=`morning-s2:${v.sha256(v.canonicalJson(expectedSourceHead)).slice(0,32)}`;
        const extension=await runtime.continueSave({contentRef:FIRST_MORNING_CATALOG.ref,sourceSaveId,expectedSourceHead,saveId:id,epoch:`${id}:epoch`,clientRequestId:`${id}:upgrade`,kind:"upgrade"});
        if(!extension.ok || !consumeLastPage) return extension;
        return runtime.dispatch({protocolVersion:4,saveId:id,expectedHead:extension.receipt.after,clientRequestId:`${id}:advance`,command:{type:"advance-opening",step:66,choice:"continue"}});
      },
      async importSave(raw: unknown) {
        try {
          const r = v.record(raw, "import");
          if (r.format === "legacy") return legacy.application.importSave({protocolVersion: 1, saveId: r.saveId, epoch: r.epoch, clientRequestId: r.clientRequestId, format: r.format, archive: r.archive});
          const archive = JSON.parse(v.text(r.archive, "archive", 8 * 1024 * 1024));
          if (archive.archiveVersion === 1) return legacy.application.importSave({protocolVersion: 1, saveId: r.saveId, epoch: r.epoch, clientRequestId: r.clientRequestId, format: r.format, archive: r.archive});
          return runtime.importSave({contentRef: archive.record.contentRef, request: {protocolVersion: archive.archiveVersion, saveId: r.saveId, epoch: r.epoch, clientRequestId: r.clientRequestId, archive: r.archive}});
        } catch (e) { return {ok: false as const, error: applicationError(e)}; }
      },
    },
  };
}
