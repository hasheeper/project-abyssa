import { useEffect, useRef, useState } from "react";
import { createBrowserGameRuntime } from "../../game-runtime/browser";
import type { PlayerSaveListEntry as SaveListEntry } from "../../game-runtime/player-runtime";
import { activeRunId } from "../../game-client/session";
import { gameHref, recentSave, rememberSave, recordLocator, type SaveLocator } from "../../game-client/navigation";
import { downloadJson, gameErrorText } from "../../game-client/react";

const creationKey = "abyssa:new-save:loop-v1";
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
  async function list() {
    const source = runtime.current;
    const result = await source!.application.list();
    if (!alive.current || runtime.current !== source) return;
    if (result.ok) { setSaves(result.saves); setMessage(result.saves.length ? "选择继续游戏，或开启新的档案。" : "尚未有存档。"); }
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
    const result = await runtime.current!.application.open(locator.saveId);
    if (!alive.current) return;
    if (!result.ok) { setMessage(gameErrorText(result.error.code)); return; }
    if (result.record.head.epoch !== locator.epoch) { setMessage(gameErrorText("identity-mismatch")); return; }
    rememberSave(locator);
    const expeditionId = activeRunId(result.record);
    navigate(gameHref(expeditionId ? "battle" : "menu", recordLocator(result.record)));
    return true;
  }
  return {
    saves, busy, message, open, setOpen,
    choose: (locator: SaveLocator) => operation(() => enter(locator)),
    continueGame: () => operation(async () => {
      const recent = recentSave(), ready = saves.filter(s => s.status === "ready");
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
