import { useEffect, useRef, useState, type CSSProperties } from "react";
import { browserArchiveStore, slotRecord, type SaveSlotIndex, type ArchiveTarget } from "../game-runtime/save-slots";
import { savePresentation } from "../game-runtime/save-presentation";
import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import { SystemPanel } from "../shared/ui/patterns/SystemPanel";
import { SystemTabs } from "../shared/ui/patterns/SystemTabs";
import { RpgHexButton } from "../shared/ui/primitives/RpgHexButton";
import { InlineFeedback } from "../shared/ui/patterns/SceneFeedback";
import { SaveFileIcon } from "./SaveFileIcon";
import { SaveSlotGrid, slotNumber } from "./SaveSlotGrid";
import { useSaveArchive } from "./useSaveArchive";
import { useSaveSlots } from "./useSaveSlots";
import { activeRunId } from "./session";
import type { ManualSaveAttempt } from "./manual-save";
import { useSaveSlotMotion } from "./useSaveSlotMotion";
import { slotTiming, type SaveSlotSceneMotion } from "./save-slots-motion";
import { useArchiveFeedback } from "./ArchiveFeedback";
import { announceDeletedSave } from "./deleted-save-hints";
import { parseLocator } from "./navigation";
import { routeSearch } from "../shared/routing/location";
import { SystemSceneHeading } from "./SystemSceneFrame";
import "./save-slots.css";

type Props = { onClose: () => void; onBusyChange: (busy: boolean) => void; navigate: (href: string) => void; sceneMotion?: SaveSlotSceneMotion; fullScene?: boolean; returnLabel?: string } & (
  { mode: "save"; attempt: ManualSaveAttempt; ready: boolean } | { mode: "load" }
);
type PendingSlot = { position: number; index: SaveSlotIndex; savedAt: string; target?: ArchiveTarget };

/** Slot writes and permanent archive removal commit together. */
export function SaveSlotsPanel(props: Props) {
  const { mode, onClose, onBusyChange, navigate } = props;
  const archive = useSaveArchive(navigate), feedback = useArchiveFeedback();
  const [copies, setCopies] = useState<PlayerSaveListEntry[]>([]);
  const saves = [...archive.saves, ...copies.filter(copy => !archive.saves.some(save => save.saveId === copy.saveId))];
  const slots = useSaveSlots(saves);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [format, setFormat] = useState<"application" | "legacy" | "restore">("application");
  const fileInput = useRef<HTMLInputElement>(null), primary = useRef<HTMLButtonElement>(null);
  const alive = useRef(false), locked = useRef(false), pending = useRef<PendingSlot | null>(null);
  const sourceAttempt = props.mode === "save" ? props.attempt : null;
  const directorCopy = sourceAttempt?.source.schemaVersion === 4 && !!sourceAttempt.source.airpDirector;
  const attempt = useRef(sourceAttempt);
  const protectedSaveId = sourceAttempt?.source.head.saveId ?? parseLocator(routeSearch())?.saveId;
  useEffect(() => { onBusyChange(busy || archive.operationBusy || feedback.blocked); }, [busy, archive.operationBusy, feedback.blocked, onBusyChange]);
  useEffect(() => {
    attempt.current = sourceAttempt;
    pending.current = null; setMessage(""); setFailed(false); setImportOpen(false);
  }, [mode, sourceAttempt]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const index = slots.index, binding = index?.slots[selected] ?? null;
  const record = slotRecord(binding, saves);
  const panelRef = useRef<HTMLElement>(null);
  const page = Math.floor(selected / 10);
  const motionReady = (archive.listState !== "loading" && !!index) || !!slots.error || archive.listState === "error";
  const loading = !index || archive.listState !== "ready";
  const slotMotion = useSaveSlotMotion(panelRef, page, motionReady, props.sceneMotion, saves.map(save => save.saveId).join(","));
  const blocked = busy || feedback.blocked || archive.busy || archive.listState !== "ready" || !index || slotMotion.changing;
  const protectedSlot = mode === "save" && binding?.saveId === protectedSaveId;
  const canAct = !blocked && !protectedSlot && !directorCopy && (props.mode === "save" ? props.ready : record?.status === "ready" && !archive.archivedIds.has(record.saveId));
  function select(position: number) {
    if (locked.current || blocked) return;
    setSelected(position); setMessage(""); setFailed(false); pending.current = null;
    if (Math.floor(position / 10) !== page) setImportOpen(false);
  }
  function refresh() { pending.current = null; setMessage(""); setFailed(false); void slots.reload(); void archive.refresh(); }
  async function save(target: PendingSlot) {
    if (locked.current || !attempt.current) throw new Error("请等待当前存档完成。");
    locked.current = true; setBusy(true); setFailed(false); setMessage("");
    pending.current = target;
    try {
      const prepared = await attempt.current.prepare();
      const updated = await browserArchiveStore.change({ index: target.index, target: target.target, protectedSaveId,
        replacement: { position: target.position, savedAt: target.savedAt, save: prepared } });
      if (target.target) announceDeletedSave(target.target);
      if (!alive.current) return "存档已保存";
      const source = attempt.current.source, locator = prepared.record.head;
      const copy: PlayerSaveListEntry = { status: "ready", saveId: locator.saveId,
        summary: { head: locator, contentRef: source.contentRef, activeExpeditionId: activeRunId(source) ?? null },
        clock: source.snapshot.campaign.clock, presentation: savePresentation(source) };
      if (target.target) archive.removeFromList(target.target.saveId);
      setCopies(prior => [...prior.filter(save => save.saveId !== target.target?.saveId), copy]); slots.setIndex(updated);
      pending.current = null; attempt.current = attempt.current.fork();
      return "已保存至槽位 " + slotNumber(target.position);
    } catch (cause) {
      if (alive.current) setFailed(true);
      throw cause;
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function activate() {
    if (!canAct || locked.current || !index) return;
    if (mode === "load") {
      if (record?.status === "ready") void archive.choose({ saveId: record.saveId, epoch: record.summary.head.epoch });
      return;
    }
    const target: PendingSlot = pending.current ?? { position: selected, index, savedAt: new Date().toISOString() };
    try {
      if (binding) {
        locked.current = true; setBusy(true);
        target.target = await browserArchiveStore.inspect(binding.saveId, record?.status === "ready" ? record.summary.head : undefined);
        if (alive.current) feedback.ask({ title: "覆盖槽位 " + slotNumber(target.position) + "？",
          description: "旧档案将被永久删除，并替换为当前进度。此操作无法撤销。", label: "确认覆盖", refresh, work: () => save(target) });
      } else feedback.notify(await save(target));
    } catch (cause) { if (alive.current) setMessage(cause instanceof Error ? cause.message : "存档未完成，请重试。"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function remove(position: number) {
    if (blocked || locked.current || !index) return;
    const bound = index.slots[position];
    if (!bound || bound.saveId === protectedSaveId) return;
    locked.current = true; setBusy(true); setMessage("");
    try {
      const entry = slotRecord(bound, saves);
      const target = await browserArchiveStore.inspect(bound.saveId, entry?.status === "ready" ? entry.summary.head : undefined);
      if (!alive.current) return;
      feedback.ask({ title: "删除槽位 " + slotNumber(position) + "？",
        description: "此档案及其本机记录将被永久删除，槽位恢复为空。删除后无法恢复。", label: "删除档案", refresh, work: async () => {
          const updated = await browserArchiveStore.change({index, target, protectedSaveId});
          announceDeletedSave(target); archive.removeFromList(target.saveId);
          setCopies(prior => prior.filter(save => save.saveId !== target.saveId)); slots.setIndex(updated);
          return "槽位 " + slotNumber(position) + " 已删除";
        }});
    } catch (cause) { if (alive.current) setMessage(cause instanceof Error ? cause.message : "无法读取待删除档案。"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  const exitBlocked = busy || archive.operationBusy || feedback.blocked;
  function back() {
    if (locked.current || exitBlocked) return;
    if (importOpen) setImportOpen(false); else onClose();
  }
  return <><SystemPanel ref={panelRef} embedded className={`save-slots${props.fullScene ? " system-scene__layout" : ""}`} label={mode.toUpperCase()} description={mode === "save" ? "保存档案" : "读取档案"}
    heading={props.fullScene ? <SystemSceneHeading label={mode.toUpperCase()} description={mode === "save" ? "保存档案" : "读取档案"} /> : undefined}
    data-slot-motion={!!props.sceneMotion || undefined} data-slot-reduced={slotMotion.skip || undefined} data-slot-page-phase={slotMotion.phase}
    data-slot-waiting={!motionReady || undefined} data-slot-exiting={props.sceneMotion?.exiting || undefined}
    style={{ "--slot-select-ms": `${slotTiming.selectMs}ms`, "--slot-selected-scale": slotTiming.selectScale } as CSSProperties}
    tabs={<div className="abyssa-system-toolbar" inert={slotMotion.changing}>
      <span className="abyssa-system-toolbar__label">{mode === "save" ? "选择存档位置" : "选择读取档案"}</span>
      <SystemTabs pages label="存档分页" disabled={blocked} selected={String(page)} onChange={n => select(Number(n) * 10 + selected % 10)}
        items={[0, 1, 2].map(n => ({ id: String(n), label: `${slotNumber(n * 10)}—${slotNumber(n * 10 + 9)}`, accessibleLabel: `第 ${n + 1} 页，槽位 ${n * 10 + 1} 至 ${n * 10 + 10}` }))} />
      <div className="abyssa-system-toolbar__actions">
        <button type="button" className="save-slots__import-button" disabled={busy || archive.busy || feedback.blocked} onClick={() => setImportOpen(!importOpen)}
          aria-label="导入档案" title="导入档案" aria-expanded={importOpen}><SaveFileIcon direction="import" /></button>
      </div>
    </div>}
    footer={<div className="save-slots__footer-actions" inert={slotMotion.changing}>
      <div className="save-slots__feedback">
        {(message || slots.error || archive.listState !== "loading" && archive.message) && <InlineFeedback message={message || slots.error || archive.message} action={message ? {label: "刷新档案", onClick: () => { pending.current = null; setMessage(""); setFailed(false); void slots.reload(); void archive.refresh(); }} : undefined} />}
        {protectedSlot && !message && <span>当前旅程正在使用此档案，请选择其他槽位。</span>}
        {directorCopy && <span>总管理验证档会自动保存，暂不支持槽位副本。完整备份请从档案管理导出，并以原身份恢复。</span>}
      </div>
      <RpgHexButton size="sm" disabled={exitBlocked} onClick={back} aria-label={props.returnLabel ?? "返回主菜单"}>返回</RpgHexButton>
      <RpgHexButton ref={primary} size="sm" disabled={!canAct} onClick={() => void activate()}
        aria-label={mode === "load" ? "读取所选档案" : failed ? "重试存档" : "确认存档"}>
        {busy ? "处理中…" : mode === "load" ? `读取 ${slotNumber(selected)}` : failed ? "重试" : `保存 ${slotNumber(selected)}`}
      </RpgHexButton>
    </div>} onKeyDown={event => {
      if (event.key === "Escape" && importOpen) { event.preventDefault(); event.stopPropagation(); back(); }
    }}>
    {importOpen && <div className="save-slots__import" role="region" aria-label="导入档案">
      <label>导入格式 <select value={format} disabled={blocked} onChange={event => setFormat(event.target.value as typeof format)}>
        <option value="application">普通档案 · 新副本</option><option value="restore">AIRP 备份 · 原身份</option><option value="legacy">旧版战斗存档</option>
      </select></label>
      <button type="button" disabled={blocked} onClick={() => fileInput.current?.click()}>选择 JSON 文件</button>
      <button type="button" disabled={exitBlocked} onClick={() => setImportOpen(false)}>收起</button>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="导入存档" hidden disabled={blocked}
        onChange={event => { const file = event.target.files?.[0]; if (file) void archive.importGame(file, format); event.target.value = ""; }} />
    </div>}
    <SaveSlotGrid index={index} saves={saves} selected={selected} onSelect={select} loading={loading}
      page={slotMotion.page} changing={slotMotion.changing} disabled={busy || archive.busy || feedback.blocked} onActivate={() => void activate()} onDelete={position => void remove(position)} protectedSaveId={protectedSaveId}
      onExport={save => { if (!slotMotion.changing) void archive.exportGame(save.saveId, save.status === "unavailable"); }} />
    {loading && (slots.error || archive.listState === "error" ? <div className="save-slots__loading"><button type="button" disabled={busy || archive.busy || feedback.blocked}
      onClick={() => { void slots.reload(); void archive.refresh(); }}>重新读取档案</button></div>
      : <span className="save-slots__loading-status" role="status" aria-label="正在读取档案" />)}
  </SystemPanel>{feedback.layer}</>;
}
