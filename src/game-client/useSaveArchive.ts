import { useEffect, useRef, useState } from "react";
import type { createBrowserGameRuntime } from "../game-runtime/browser";
import type { GameStartPoint, PlayerSaveListEntry as SaveListEntry } from "../game-runtime/player-runtime";
import { gameHref, recentSave, rememberSave, recordLocator, locatorHasRun, type SaveLocator } from "./navigation";
import { downloadJson, gameErrorText } from "./game-errors";
import { readTitleSaveList } from "./title-save-list";
import { archiveCandidates, isSaveArchived, readSaveArchive, writeSaveArchive, type ArchivedSave } from "./save-archive";
import { parsePlayerName } from "../game-runtime/player-name";
type NewGameSelection = { startAt: GameStartPoint; playerName: string };

const creationKey = "abyssa:new-save:airp-v1";
const importKey = "abyssa:import-save:v1";
export const NEW_GAME_PENDING_KEY = "abyssa:new-save:opening-v1";
function pendingOpening(): NewGameSelection | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(NEW_GAME_PENDING_KEY) ?? "null");
    if (!value || !["prologue", "first-morning", "tutorial", "hub", "debug-shop", "airp-demo", "airp-director"].includes(value.startAt)) return null;
    return {startAt: value.startAt, playerName: parsePlayerName(value.playerName)};
  } catch { return null; }
}
type Identity = { protocolVersion: 1 | 2 | 3 | 4; contentVersion?: number; profileId?: string; saveId: string; epoch: string; clientRequestId: string };
function identity(runtime: ReturnType<typeof createBrowserGameRuntime>, key: string): Identity {
  try {
    const prior = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if ([1, 2, 3, 4].includes(prior?.protocolVersion) && [prior.saveId, prior.epoch, prior.clientRequestId].every(id => typeof id === "string" && /^[\w:-]{1,192}$/.test(id))) return prior;
  } catch { /* Invalid hint is replaced before submitting. */ }
  const next: Identity = { ...(runtime.defaultCreation ?? {protocolVersion: 1 as const}), saveId: runtime.newId(), epoch: runtime.newId(), clientRequestId: runtime.newId() };
  sessionStorage.setItem(key, JSON.stringify(next)); return next;
}
export function useSaveArchive(navigate: (href: string) => void, options: { onBusyChange?: (busy: boolean) => void } = {}) {
  const busyListener = useRef(options.onBusyChange);
  busyListener.current = options.onBusyChange;
  const [operationBusy, setOperationBusy] = useState(false);
  const [interactionBusy, setInteractionBusy] = useState(false);
  const runtime = useRef<ReturnType<typeof createBrowserGameRuntime> | null>(null);
  const listing = useRef<AbortController | null>(null);
  const alive = useRef(false), locked = useRef(false), generation = useRef(0);
  const leaving = useRef(false);
  const [saves, setSaves] = useState<SaveListEntry[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(true), [message, setMessage] = useState("正在读取档案…");
  const [open, setOpen] = useState(false);
  const [pendingNewGame, setPendingNewGame] = useState(pendingOpening);
  const [archived, setArchived] = useState<ArchivedSave[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  async function list() {
    setListState("loading");
    listing.current?.abort();
    const controller = new AbortController(); listing.current = controller;
    try {
      const result = await readTitleSaveList(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (result.ok) { setSaves(result.saves); setArchived(readSaveArchive(localStorage)); setListState("ready"); setMessage(""); }
      else { setListState("error"); setMessage(gameErrorText(result.error.code)); }
    } catch {
      if (alive.current && !controller.signal.aborted) { setListState("error"); setMessage("本机存档暂不可用，请重新读取档案。"); }
    } finally { if (listing.current === controller) listing.current = null; }
  }
  useEffect(() => {
    alive.current = true; const version = ++generation.current;
    // The discarded StrictMode setup must not start a second database scan.
    queueMicrotask(() => {
      if (alive.current && version === generation.current) void list().finally(() => { if (alive.current && version === generation.current && !locked.current) setBusy(false); });
    });
    return () => { alive.current = false; listing.current?.abort(); runtime.current?.close(); runtime.current = null; };
  }, []);
  async function operation(work: () => Promise<unknown>) {
    if (!alive.current || locked.current) return;
    const version = generation.current;
    locked.current = true; busyListener.current?.(true); setOperationBusy(true); setBusy(true);
    try {
      if (!runtime.current) {
        const module = await import("../game-runtime/browser");
        if (!alive.current || version !== generation.current) return;
        runtime.current = module.createBrowserGameRuntime();
      }
      await work();
    } catch { if (alive.current && version === generation.current) setMessage("档案操作未完成，请重试；原有档案已保留。"); }
    finally {
      locked.current = leaving.current;
      if (alive.current && version === generation.current) {
        setBusy(leaving.current); setOperationBusy(leaving.current); busyListener.current?.(leaving.current);
      }
    }
  }
  async function enter(locator: SaveLocator) {
    let result = await runtime.current!.application.open(locator.saveId);
    if (!alive.current) return;
    if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
    if (result.record.head.epoch !== locator.epoch) { setMessage(gameErrorText("identity-mismatch")); return; }
    // Continue the append-only opening without asking the player to restart S1. Keep the original save.
    if(result.record.schemaVersion===4 && [5,6].includes(result.record.contentRef.contentVersion)) {
      const c=result.record.snapshot.campaign;
      if(c.opening && c.opening.status!=="skipped" && !c.activeRunRef && !c.activeStoryId && !c.memory && !c.settlements.length) {
        const extension=await runtime.current!.application.extendTutorial(locator.saveId,result.record.head);
        if(!alive.current) return;
        if(!extension.ok) {setMessage(gameErrorText(extension.error.code));return;}
        result=await runtime.current!.application.open(extension.receipt.after!.saveId);
        if(!alive.current) return;
        if(!result.ok) {setMessage(gameErrorText(result.error.code));return;}
      }
    }
    const destination = recordLocator(result.record);
    rememberSave(destination);
    const prologue = result.record.schemaVersion === 4 && result.record.snapshot.campaign.prologue?.status === "playing";
    const tutorial = runtime.current!.queries.tutorial(result.record);
    const opening = result.record.schemaVersion === 4 && result.record.snapshot.campaign.opening?.status === "playing";
    const freshAirp = result.record.schemaVersion === 4 && !!result.record.snapshot.campaign.airpDemoStart && result.record.head.revision === 1;
    navigate(gameHref(prologue ? "prologue" : opening || freshAirp ? "mansion" : (locatorHasRun(destination) || tutorial?.canBegin) ? "battle" : "menu", destination));
    leaving.current = true; // Keep the archive locked until route handoff unmounts it.
    return true;
  }
  const archivedIds = new Set(saves.filter(s => isSaveArchived(s, archived, saves, recentSave())).map(s => s.saveId));
  return {
    saves: showArchived ? saves : saves.filter(s => !archivedIds.has(s.saveId)), busy: busy || interactionBusy, operationBusy, message, listState, open, setOpen, pendingNewGame,
    setInteractionBusy,
    removeFromList(saveId: string) { setSaves(prior => prior.filter(save => save.saveId !== saveId)); setArchived(prior => prior.filter(e => e.head.saveId !== saveId && e.successor.saveId !== saveId)); setMessage(""); },
    archivedIds, showArchived, setShowArchived,
    cleanup: () => operation(async () => {
      // Read again immediately before archiving: a source resumed elsewhere must not disappear.
      const result = await runtime.current!.application.list();
      if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
      const prior = readSaveArchive(localStorage), candidates = archiveCandidates(result.saves, recentSave());
      const added = candidates.filter(c => !isSaveArchived(result.saves.find(s => s.saveId === c.head.saveId)!, prior, result.saves, recentSave()));
      const next = [...prior.filter(p => !added.some(c => c.head.saveId === p.head.saveId)), ...added];
      writeSaveArchive(localStorage, next); setArchived(next); setSaves(result.saves);
      setMessage(added.length ? `已归档 ${added.length} 份已续接旧档，可在“已归档”中恢复。` : "没有可归档的已续接旧档。当前进度与独立档案均已保留。");
    }),
    restore: (saveId: string) => operation(async () => {
      const next = readSaveArchive(localStorage).filter(e => e.head.saveId !== saveId);
      writeSaveArchive(localStorage, next); setArchived(next); setMessage("档案已恢复到列表。");
    }),
    choose: (locator: SaveLocator) => operation(() => enter(locator)),
    continueGame: () => operation(async () => {
      const recent = recentSave(), ready = saves.filter((s): s is Extract<SaveListEntry, {status:"ready"}> => s.status === "ready" && !archivedIds.has(s.saveId));
      const selected = ready.find(s => s.saveId === recent?.saveId && s.summary.head.epoch === recent?.epoch) ?? (ready.length === 1 ? ready[0] : undefined);
      if (selected) await enter({ saveId: selected.saveId, epoch: selected.summary.head.epoch });
      else { setOpen(true); if (!ready.length) setMessage("还没有可继续的档案，请选择新的开始或导入。"); }
    }),
    newGame: (startAt: GameStartPoint | 10 = "prologue", playerName?: string) => operation(async () => {
      const named = startAt !== 10 && playerName !== undefined;
      const selection = named ? {startAt, playerName: parsePlayerName(playerName)} : null;
      const pending = named ? pendingOpening() : null;
      if (pending && (pending.startAt !== startAt || pending.playerName !== playerName)) {
        setMessage("上一份新档尚未建立完成，请先重试原有设置。"); return;
      }
      const key = named ? NEW_GAME_PENDING_KEY : startAt === 10 ? `${creationKey}:online-v1` : `abyssa:new-save:guided-start-v1:${startAt}`;
      if (named && !pending) sessionStorage.removeItem(key);
      const prior = identity(runtime.current!, key);
      const request = startAt === 10 ? { ...prior, protocolVersion: 4 as const, contentVersion: 10 } : prior;
      sessionStorage.setItem(key, JSON.stringify({...request, ...selection}));
      if (selection) setPendingNewGame(selection);
      setMessage("正在建立新的档案…");
      const result = startAt === 10 ? await runtime.current!.application.create(request)
        : await runtime.current!.application.createNewGame({saveId: request.saveId, epoch: request.epoch, clientRequestId: request.clientRequestId, startAt,
          ...(selection ? {playerName: selection.playerName} : {})});
      if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
      if (await enter(request)) { sessionStorage.removeItem(key); if (selection) setPendingNewGame(null); }
    }),
    importGame: (file: File, format: "application" | "legacy" | "restore") => operation(async () => {
      if (file.size > 8 * 1024 * 1024) { setMessage("档案文件超过 8 MiB，无法导入。"); return; }
      const archive = await file.text();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(archive)))).map(x => x.toString(16).padStart(2, "0")).join("");
      const signature = `${format}:${digest}`;
      if (sessionStorage.getItem(`${importKey}:signature`) !== signature) { sessionStorage.removeItem(importKey); sessionStorage.setItem(`${importKey}:signature`, signature); }
      const request = identity(runtime.current!, importKey);
      if (format === "restore") {
        const result = await runtime.current!.application.restoreSave({ archive, clientRequestId: request.clientRequestId });
        if (!result.ok) { setMessage(result.error.code === "conflict" ? "本机已有不同或更新的同身份档案，未覆盖任何进度。请载入本机档案。" : gameErrorText(result.error.code)); return; }
        if (await enter(result.head)) { sessionStorage.removeItem(importKey); sessionStorage.removeItem(`${importKey}:signature`); }
        return;
      }
      const result = await runtime.current!.application.importSave({ ...request, format, archive });
      if (!result.ok) { setMessage(result.error.code === "run-active" ? "活动委托不可复制为新档。请在导入格式选择“AIRP 备份恢复（原身份）”。" : gameErrorText(result.error.code)); return; }
      if (await enter(request)) { sessionStorage.removeItem(importKey); sessionStorage.removeItem(`${importKey}:signature`); }
    }),
    continueSave: (save: Extract<SaveListEntry,{status:"ready"}>, kind:"upgrade"|"cycle") => operation(async () => {
      const key = `abyssa:continue:${kind}:${save.saveId}:${save.summary.head.revision}`;
      const request = identity(runtime.current!,key);
      const result = await runtime.current!.application.continueSave({sourceSaveId:save.saveId,expectedSourceHead:save.summary.head,saveId:request.saveId,epoch:request.epoch,clientRequestId:request.clientRequestId,kind,contentVersion:save.summary.contentRef.contentVersion >= 9 ? 10 : 9});
      if(!result.ok) {setMessage(result.error.code === "run-active" ? "请先结束当前远征或回忆，并完成归来片段；原档保持不变。" : gameErrorText(result.error.code));return;}
      if(await enter(request)) sessionStorage.removeItem(key);
    }),
    exportGame: (saveId: string, diagnostic = false) => operation(async () => {
      const app = runtime.current!.application;
      const result = diagnostic ? await app.exportDiagnostic(saveId) : await app.exportSave(saveId);
      if (result.ok) downloadJson(result.archive, `abyssa-${diagnostic ? "diagnostic-" : ""}${saveId}.json`);
      else setMessage(gameErrorText(result.error.code));
    }),
    refresh: () => operation(list),
  };
}
