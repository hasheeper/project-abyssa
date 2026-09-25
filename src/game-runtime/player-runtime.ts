import { ESTATE_CATALOG, ESTATE_AIRP_CATALOG } from "./estate-context";
import { FACILITIES_CATALOG, FACILITIES_AIRP_CATALOG } from "./facilities-context";
import { SHOP_WAVE_CATALOG, SHOP_AIRP_CATALOG } from "./shop-wave-context";
import { ORDINARY_DROPS_CATALOG } from "./ordinary-drops-context";
import { AIRP_GAME_CATALOG } from "./airp-game-context";
import { createAirpGameRuntime } from "./airp-game-runtime";
import { guardAirpGameCommand } from "../game-application/airp-game/validation";
import { COPPER_ECONOMY_CATALOG } from "./copper-economy-context";
import { TIDE_REEF_CATALOG } from "./tide-reef-context";
import { AIRP_DIRECTOR_CATALOG } from "./airp-director-context";
import { AIRP_DIRECT_CATALOG } from "./airp-direct-context";
import { TIDE_CAVE_CATALOG } from "./tide-cave-context";
import { GUIDED_TIDE_CATALOG } from "./guided-tide-context";
import { SHOP_FOUNDATION_CATALOG } from "./shop-foundation-context";
import { SHOP_INTRODUCTION_CATALOG } from "./shop-introduction-context";
import { STARTER_REWARD_CATALOG } from "./starter-reward-context";
import { FOUR_LAYER_TUTORIAL_CATALOG } from "./four-layer-tutorial-context";
import { CHAPTER_ONE_CATALOG } from "./chapter-one-context";
import { AIRP_CATALOG, AIRP_POOL_CATALOG, AIRP_ONLINE_CATALOG } from "./airp-context";
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
import { GAME_START_POINTS, type GameStartPoint } from "../game-core/session";
import { parsePlayerName } from "../game-core/contracts";
import type { SavePresentation } from "./save-presentation";
export type { GameStartPoint } from "../game-core/session";

export type PlayerSaveListEntry = {status: "ready"; saveId: string; summary: {head: AnyGameRecord["head"]; contentRef: AnyGameRecord["contentRef"]; activeExpeditionId: string | null; supersedes?: AnyGameRecord["head"]; continuation?: {upgrade:boolean;cycle:boolean}}; clock: AnyGameRecord["snapshot"]["campaign"]["clock"]; presentation?: SavePresentation} | {status: "unavailable"; saveId: string; error: ReceiptError};
export const PLAYER_CATALOGS = [{version: 1 as const, catalog: LEGACY_VALIDATED_CATALOG}, {version: 2 as const, catalog: MANOR_CATALOG}, {version: 3 as const, catalog: FULL_MANOR_CATALOG}, {version: 4 as const, catalog: D5_FOUNDATION_CATALOG}, {version: 4 as const, catalog: LOOP_CATALOG}, {version: 4 as const, catalog: PROLOGUE_CATALOG}, {version: 4 as const, catalog: FIRST_MORNING_V1_CATALOG}, {version: 4 as const, catalog: FIRST_MORNING_CATALOG}, {version: 4 as const, catalog: TIDE_CAVE_CATALOG}, {version: 4 as const, catalog: AIRP_CATALOG}, {version: 4 as const, catalog: AIRP_POOL_CATALOG}, {version: 4 as const, catalog: AIRP_ONLINE_CATALOG}, {version: 4 as const, catalog: GUIDED_TIDE_CATALOG}, {version: 4 as const, catalog: CHAPTER_ONE_CATALOG}, {version: 4 as const, catalog: SHOP_FOUNDATION_CATALOG}, {version: 4 as const, catalog: FOUR_LAYER_TUTORIAL_CATALOG}, {version: 4 as const, catalog: STARTER_REWARD_CATALOG}, {version: 4 as const, catalog: SHOP_INTRODUCTION_CATALOG}, {version: 4 as const, catalog: COPPER_ECONOMY_CATALOG}, {version: 4 as const, catalog: AIRP_DIRECT_CATALOG}, {version: 4 as const, catalog: AIRP_DIRECTOR_CATALOG}, {version: 4 as const, catalog: TIDE_REEF_CATALOG}, {version: 4 as const, catalog: ORDINARY_DROPS_CATALOG}, {version: 4 as const, catalog: AIRP_GAME_CATALOG}, {version: 4 as const, catalog: SHOP_WAVE_CATALOG}, {version: 4 as const, catalog: SHOP_AIRP_CATALOG}, {version: 4 as const, catalog: FACILITIES_CATALOG}, {version: 4 as const, catalog: FACILITIES_AIRP_CATALOG}, {version: 4 as const, catalog: ESTATE_CATALOG}, {version: 4 as const, catalog: ESTATE_AIRP_CATALOG}];
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
    airpGame: createAirpGameRuntime(store),
    defaultCreation: {protocolVersion: 4 as const, contentVersion: 27 as const, profileId: "profile.demo.first-run"},
    queries: { ...runtime.queries, continuation(record: AnyGameRecord) {
      const next = runtime.queries.continuation(record);
      if (next && record.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion)) {
        try { guardAirpGameCommand(record, record.contentRef.contentVersion === 28 ? ESTATE_AIRP_CATALOG : record.contentRef.contentVersion === 26 ? FACILITIES_AIRP_CATALOG : record.contentRef.contentVersion === 24 ? SHOP_AIRP_CATALOG : AIRP_GAME_CATALOG, (next as import("../game-application").D5Request).command); }
        catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "command-not-available") return null; throw error; }
      }
      return next;
    } },
    createReactions: legacy.createReactions,
    close: legacy.close,
    application: {
      ...runtime,
      resumeEnemyTurn: runtime.resume,
      async list() {
        const result = await runtime.list(); if (!result.ok) return result;
        const saves: PlayerSaveListEntry[] = result.saves.map(s => s.status === "unavailable" ? s : {status: "ready", saveId: s.saveId, summary: {head: s.head, contentRef: s.contentRef, activeExpeditionId: s.activeRunId, supersedes:s.supersedes, continuation:s.continuation}, clock: s.clock, presentation: s.presentation});
        return {ok: true as const, saves};
      },
      async create(raw: unknown) {
        try {
          const request = v.record(raw, "create");
          const selected = PLAYER_CATALOGS.find(entry => entry.version === 4 && entry.catalog.ref.contentVersion >= 3 && entry.catalog.ref.contentVersion === request.contentVersion);
          if (request.protocolVersion === 4 && selected) {
            const {contentVersion: _, ...inner} = request;
            return runtime.create({contentRef: selected.catalog.ref, request: inner});
          }
          return runtime.create({contentRef: request.protocolVersion === 4 ? D5_FOUNDATION_CATALOG.ref : request.protocolVersion === 3 ? FULL_MANOR_CATALOG.ref : request.protocolVersion === 2 ? MANOR_CATALOG.ref : LEGACY_VALIDATED_CATALOG.ref, request});
        } catch (e) { return {ok: false as const, error: applicationError(e)}; }
      },
      /** Two durable, idempotent steps. A retry after either write resumes the
       * same save; only a successful selection is handed to the player UI. */
      async createNewGame(raw: {saveId: string; epoch: string; clientRequestId: string; startAt: GameStartPoint; playerName?: string}) {
        try {
          const r = v.record(raw, "newGame", ["saveId", "epoch", "clientRequestId", "startAt"], ["playerName"]);
          const startAt = v.choice(r.startAt, GAME_START_POINTS, "startAt");
          // Reject an invalid name before even the empty save is created.
          const naming = "playerName" in r ? {playerName: parsePlayerName(r.playerName)} : {};
          const catalog = startAt === "airp-director" ? ESTATE_AIRP_CATALOG : startAt === "airp-demo" ? AIRP_DIRECT_CATALOG : ESTATE_CATALOG;
          const request = {protocolVersion: 4 as const, profileId: catalog.data.journey!.defaultProfileId,
            saveId: v.id(r.saveId, "saveId"), epoch: v.id(r.epoch, "epoch"), clientRequestId: v.id(r.clientRequestId, "clientRequestId")};
          const created = await runtime.create({contentRef: catalog.ref, request});
          if (!created.ok) return created;
          // Independent of startAt: reusing an identity for a different choice
          // must fail fingerprint validation, not silently change the start.
          return await runtime.dispatch({protocolVersion: 4, saveId: request.saveId, expectedHead: created.receipt.after,
            clientRequestId: `start:${v.sha256(v.canonicalJson(request)).slice(0, 32)}`,
            command: {type: "select-game-start", startAt, ...naming}});
        } catch (e) { return {ok: false as const, error: applicationError(e)}; }
      },
      continueSave(raw: {sourceSaveId:string;expectedSourceHead:AnyGameRecord["head"];saveId:string;epoch:string;clientRequestId:string;kind:"upgrade"|"cycle";contentVersion?:8|9|10}) {
        const {contentVersion, ...request} = raw;
        return runtime.continueSave({...request,contentRef:contentVersion === 10 ? AIRP_ONLINE_CATALOG.ref : contentVersion === 8 ? AIRP_CATALOG.ref : AIRP_POOL_CATALOG.ref});
      },
      async extendTutorial(sourceSaveId:string, expectedSourceHead:AnyGameRecord["head"]) {
        const id = `tide-cave:${v.sha256(v.canonicalJson(expectedSourceHead)).slice(0,32)}`;
        return runtime.continueSave({contentRef:TIDE_CAVE_CATALOG.ref,sourceSaveId,expectedSourceHead,saveId:id,epoch:`${id}:epoch`,clientRequestId:`${id}:upgrade`,kind:"upgrade"});
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
          const archivedRecord = v.record(v.isPooledJson(archive.record) ? v.unpoolSaveJson(archive.record) : archive.record, "record");
          return runtime.importSave({contentRef: archivedRecord.contentRef, request: {protocolVersion: archive.archiveVersion, saveId: r.saveId, epoch: r.epoch, clientRequestId: r.clientRequestId, archive: r.archive}});
        } catch (e) { return {ok: false as const, error: applicationError(e)}; }
      },
    },
  };
}
