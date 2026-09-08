import { useEffect, useRef, useState } from "react";
import { createBrowserGameRuntime } from "../../game-runtime/browser";
import type { PlayerSaveListEntry as SaveListEntry } from "../../game-runtime/player-runtime";
import { activeRunId } from "../../game-client/session";
import { gameHref, recentSave, rememberSave, recordLocator, type SaveLocator } from "../../game-client/navigation";
import { downloadJson, gameErrorText } from "../../game-client/react";
import { archiveCandidates, isSaveArchived, readSaveArchive, writeSaveArchive, type ArchivedSave } from "../../game-client/save-archive";

const creationKey = "abyssa:new-save:first-morning-v2";
const importKey = "abyssa:import-save:v1";
type Identity = { protocolVersion: 1 | 2 | 3 | 4; contentVersion?: number; profileId?: string; saveId: string; epoch: string; clientRequestId: string };
function identity(runtime: ReturnType<typeof createBrowserGameRuntime>, key: string): Identity {
  try {
    const prior = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if ([1, 2, 3, 4].includes(prior?.protocolVersion) && [prior.saveId, prior.epoch, prior.clientRequestId].every(id => typeof id === "string" && /^[\w:-]{1,192}$/.test(id))) return prior;
  } catch { /* Invalid hint is replaced before submitting. */ }
  const next: Identity = { ...(runtime.defaultCreation ?? {protocolVersion: 1 as const}), saveId: runtime.newId(), epoch: runtime.newId(), clientRequestId: runtime.newId() };
  sessionStorage.setItem(key, JSON.stringify(next)); return next;
}
export function useTitleArchive(navigate: (href: string) => void) {
  const runtime = useRef<ReturnType<typeof createBrowserGameRuntime> | null>(null);
  const alive = useRef(false), locked = useRef(false), generation = useRef(0);
  const [saves, setSaves] = useState<SaveListEntry[]>([]);
  const [busy, setBusy] = useState(true), [message, setMessage] = useState("正在读取档案…");
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState<ArchivedSave[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  async function list() {
    const source = runtime.current;
    const result = await source!.application.list();
    if (!alive.current || runtime.current !== source) return;
    if (result.ok) { setSaves(result.saves); setArchived(readSaveArchive(localStorage)); setMessage(result.saves.length ? "选择继续游戏，或开启新的档案。" : "尚未有存档。"); }
    else setMessage(gameErrorText(result.error.code));
  }
  useEffect(() => {
    alive.current = true; const version = ++generation.current;
    try { runtime.current = createBrowserGameRuntime(); void list().finally(() => { if (alive.current && version === generation.current) setBusy(false); }); }
    catch { setMessage("本机存档暂不可用，请刷新后重试。"); setBusy(false); }
    return () => { alive.current = false; runtime.current?.close(); runtime.current = null; };
  }, []);
  async function operation(work: () => Promise<unknown>) {
    if (!alive.current || locked.current || !runtime.current) return;
    locked.current = true; setBusy(true);
    try { await work(); } catch { if (alive.current) setMessage("档案操作未完成，请重试；原有档案已保留。"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function enter(locator: SaveLocator) {
    let result = await runtime.current!.application.open(locator.saveId);
    if (!alive.current) return;
    if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
    if (result.record.head.epoch !== locator.epoch) { setMessage(gameErrorText("identity-mismatch")); return; }
    // Continue the append-only opening without asking the player to restart S1. Keep the original save.
    if(result.record.schemaVersion===4 && result.record.contentRef.contentVersion===5) {
      const c=result.record.snapshot.campaign;
      if(c.opening && c.opening.status!=="skipped" && !c.activeRunRef && !c.activeStoryId && !c.memory && !c.settlements.length) {
        const extension=await runtime.current!.application.extendOpening(locator.saveId,result.record.head);
        if(!alive.current) return;
        if(!extension.ok) {setMessage(gameErrorText(extension.error.code));return;}
        result=await runtime.current!.application.open(extension.receipt.after!.saveId);
        if(!alive.current) return;
        if(!result.ok) {setMessage(gameErrorText(result.error.code));return;}
      }
    }
    rememberSave(recordLocator(result.record));
    const expeditionId = activeRunId(result.record);
    const prologue = result.record.schemaVersion === 4 && result.record.snapshot.campaign.prologue?.status === "playing";
    const opening = result.record.schemaVersion === 4 && result.record.snapshot.campaign.opening?.status === "playing";
    navigate(gameHref(prologue ? "prologue" : opening ? "mansion" : expeditionId ? "battle" : "menu", recordLocator(result.record)));
    return true;
  }
  const archivedIds = new Set(saves.filter(s => isSaveArchived(s, archived, saves, recentSave())).map(s => s.saveId));
  return {
    saves: showArchived ? saves : saves.filter(s => !archivedIds.has(s.saveId)), busy, message, open, setOpen,
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
    newGame: () => operation(async () => {
      const request = identity(runtime.current!, creationKey);
      const result = await runtime.current!.application.create(request);
      if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
      if (await enter(request)) sessionStorage.removeItem(creationKey);
    }),
    importGame: (file: File, format: "application" | "legacy") => operation(async () => {
      if (file.size > 8 * 1024 * 1024) { setMessage("档案文件超过 8 MiB，无法导入。"); return; }
      const archive = await file.text();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(archive)))).map(x => x.toString(16).padStart(2, "0")).join("");
      const signature = `${format}:${digest}`;
      if (sessionStorage.getItem(`${importKey}:signature`) !== signature) { sessionStorage.removeItem(importKey); sessionStorage.setItem(`${importKey}:signature`, signature); }
      const request = identity(runtime.current!, importKey);
      const result = await runtime.current!.application.importSave({ ...request, format, archive });
      if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
      if (await enter(request)) { sessionStorage.removeItem(importKey); sessionStorage.removeItem(`${importKey}:signature`); }
    }),
    continueSave: (save: Extract<SaveListEntry,{status:"ready"}>, kind:"upgrade"|"cycle") => operation(async () => {
      const key = `abyssa:continue:${kind}:${save.saveId}:${save.summary.head.revision}`;
      const request = identity(runtime.current!,key);
      const result = await runtime.current!.application.continueSave({sourceSaveId:save.saveId,expectedSourceHead:save.summary.head,saveId:request.saveId,epoch:request.epoch,clientRequestId:request.clientRequestId,kind});
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
