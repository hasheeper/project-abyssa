import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SystemPanel } from "../shared/ui/patterns/SystemPanel";
import { SystemTabs } from "../shared/ui/patterns/SystemTabs";
import { SystemSceneHeading } from "./SystemSceneFrame";
import { RpgHexButton } from "../shared/ui/primitives/RpgHexButton";
import type { ReactNode } from "react";
import type { useSaveArchive } from "./useSaveArchive";
import { recentSave } from "./navigation";
import { saveScene } from "./save-scene";
import { SaveFileIcon } from "./SaveFileIcon";
import { ARCHIVE_PAGE_SIZE, ArchiveRecordGrid } from "./ArchiveRecordGrid";
import { useSaveSlots } from "./useSaveSlots";
import { useSaveSlotMotion } from "./useSaveSlotMotion";
import type { SaveSlotSceneMotion } from "./save-slots-motion";
import "../shared/ui/styles/system-records.css";
import "./save-slots.css";
import { useArchiveFeedback } from "./ArchiveFeedback";
import { InlineFeedback } from "../shared/ui/patterns/SceneFeedback";
import { browserArchiveStore } from "../game-runtime/save-slots";
import { announceDeletedSave } from "./deleted-save-hints";

function ArchiveAction({ label, children, ...props }: { label: string; children: ReactNode; className?: string; disabled?: boolean; onClick: () => void }) {
  return <RpgHexButton size="sm" aria-label={label} {...props}>{children}</RpgHexButton>;
}
type Archive = ReturnType<typeof useSaveArchive>;
type Props = { archive: Archive; onNewGame?: () => void; sceneMotion?: SaveSlotSceneMotion; returnLabel?: string };

/** Title's full directory shares Menu's rail artwork and choreography, not its slot cap. */
export function SaveArchivePanel({ archive, onNewGame, sceneMotion, returnLabel = "返回标题" }: Props) {
  const feedback = useArchiveFeedback();
  const [preparing, setPreparing] = useState(false), [error, setError] = useState("");
  const preparingRef = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { archive.setInteractionBusy?.(preparing || feedback.blocked); }, [archive.setInteractionBusy, preparing, feedback.blocked]);
  useEffect(() => () => archive.setInteractionBusy?.(false), [archive.setInteractionBusy]);
  const [view, setView] = useState<"list" | "manage" | "import">("list");
  const [chosen, setChosen] = useState<string | null>(null);
  const [importFormat, setImportFormat] = useState<"application" | "legacy" | "restore">("application");
  const fileInput = useRef<HTMLInputElement>(null), contents = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null), headingRef = useRef<HTMLHeadingElement>(null);
  const priorView = useRef(view);
  const recent = recentSave();
  const isRecent = (save: Archive["saves"][number]) => save.status === "ready" && save.saveId === recent?.saveId && save.summary.head.epoch === recent.epoch;
  const saves = [...archive.saves].sort((a, b) => Number(isRecent(b)) - Number(isRecent(a)));
  const selected = saves.find(save => save.saveId === chosen) ?? saves.find(save => save.status === "ready") ?? saves[0];
  const page = Math.max(0, Math.floor(saves.findIndex(save => save.saveId === selected?.saveId) / ARCHIVE_PAGE_SIZE));
  const pages = Math.max(1, Math.ceil(saves.length / ARCHIVE_PAGE_SIZE));
  const motion = useSaveSlotMotion(panel, page, archive.listState !== "loading", sceneMotion, `${view}:${saves.map(save => save.saveId).join(",")}`);
  const slots = useSaveSlots(archive.saves);
  const blocked = archive.busy || motion.changing || preparing || feedback.blocked;
  const canLoad = !blocked && selected?.status === "ready" && !archive.archivedIds.has(selected.saveId);
  useLayoutEffect(() => {
    if (priorView.current === view) return;
    priorView.current = view;
    const target = view === "list"
      ? contents.current?.querySelector<HTMLElement>('[data-save-option][aria-pressed="true"], .title-archive__empty button')
      : headingRef.current;
    (target ?? headingRef.current)?.focus({ preventScroll: true });
  }, [view]);
  function load() {
    if (canLoad && selected?.status === "ready") void archive.choose({ saveId: selected.saveId, epoch: selected.summary.head.epoch });
  }
  function back() {
    if (blocked) return;
    if (view !== "list") setView("list"); else archive.setOpen(false);
  }
  async function remove(save: Archive["saves"][number]) {
    if (blocked || preparingRef.current || !slots.index) return;
    preparingRef.current = true; setPreparing(true); setError("");
    const index = slots.index;
    try {
      const target = await browserArchiveStore.inspect(save.saveId, save.status === "ready" ? save.summary.head : undefined);
      if (!alive.current) return;
      const name = save.status === "ready" ? (save.presentation?.playerName || "未命名旅程") + " · " + saveScene(save).title : "暂不可读取的档案";
      feedback.ask({title: "删除这份档案？", description: name + "\n此档案及其本机记录将被永久删除，关联槽位恢复为空。删除后无法恢复。",
        label: "删除档案", refresh: () => { void slots.reload(); void archive.refresh(); }, work: async () => {
          const updated = await browserArchiveStore.change({index, target});
          announceDeletedSave(target); archive.removeFromList(save.saveId); slots.setIndex(updated);
          return "档案已永久删除";
        }});
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "无法读取待删除档案。"); }
    finally { preparingRef.current = false; if (alive.current) setPreparing(false); }
  }
  // A sliding three-page window keeps the header bounded, even for hundreds of saves.
  const firstPage = Math.max(0, Math.min(page - 1, pages - 3));
  const heading = view === "import" ? "导入档案" : "档案管理";
  return <><SystemPanel ref={panel} embedded className="save-slots system-scene__layout title-archive__layout" label="LOAD" description="读取档案"
    data-slot-motion={!!sceneMotion || undefined} data-slot-reduced={motion.skip || undefined}
    data-slot-waiting={archive.listState === "loading" || undefined} data-slot-exiting={sceneMotion?.exiting || undefined}
    data-slot-page-phase={motion.phase}
    heading={<SystemSceneHeading label="LOAD" description="读取档案" />}
    tabs={<div className="abyssa-system-toolbar">
      <span className="title-archive__count">本机档案 <small>{saves.length}</small></span>
      <SystemTabs pages label="档案分页" disabled={blocked || view !== "list"} selected={String(page)}
        onChange={n => setChosen(saves[Number(n) * ARCHIVE_PAGE_SIZE].saveId)}
        items={Array.from({ length: Math.min(3, pages) }, (_, i) => {
          const n = firstPage + i;
          return { id: String(n), label: String(n + 1).padStart(2, "0"), accessibleLabel: `第 ${n + 1} 页档案` };
        })} />
      <div className="abyssa-system-toolbar__actions">
        <button type="button" className="save-slots__import-button" title="导入档案" aria-label="导入档案" disabled={blocked}
          aria-expanded={view === "import"} onClick={() => setView(view === "import" ? "list" : "import")}><SaveFileIcon direction="import" /></button>
        <button type="button" className="title-archive__more" title="档案管理" aria-label="档案管理" disabled={blocked}
          aria-expanded={view === "manage"} onClick={() => setView(view === "manage" ? "list" : "manage")}><span aria-hidden="true">…</span></button>
      </div>
    </div>}
    footer={<div className="save-slots__footer-actions">
      <div className="save-slots__feedback">{error ? <InlineFeedback message={error} action={{label: "刷新档案", onClick: () => { setError(""); void slots.reload(); void archive.refresh(); }}} /> : <span role="status">{archive.listState !== "loading" && (archive.message ||
        (selected && archive.archivedIds.has(selected.saveId) ? "此档案已归档，请恢复后读取。" : ""))}</span>}</div>
      <ArchiveAction label={view === "list" ? returnLabel : "返回档案"} disabled={blocked} onClick={back}>返回</ArchiveAction>
      {view === "list" && saves.length > 0 && <ArchiveAction label="读取所选档案" disabled={!canLoad} onClick={load}>读取档案</ArchiveAction>}
    </div>} onKeyDown={event => {
      if (event.key === "Escape" && view !== "list") { event.stopPropagation(); event.preventDefault(); back(); }
    }}>
    <div ref={contents} className="title-archive__contents" aria-busy={archive.busy}>
      <div className="title-archive__records" inert={view !== "list"} aria-hidden={view !== "list" || undefined} data-hidden={view !== "list" || undefined}>
        <ArchiveRecordGrid saves={saves} selected={selected?.saveId} page={motion.page} changing={motion.changing}
          disabled={blocked} loading={archive.listState === "loading"} index={slots.index} archivedIds={archive.archivedIds}
          onSelect={id => { if (!blocked) setChosen(id); }} onActivate={load}
          onDelete={save => void remove(save)}
          onExport={save => { if (!blocked) void archive.exportGame(save.saveId, save.status === "unavailable"); }} />
        {!saves.length && archive.listState !== "loading" && <div className="title-archive__empty" data-record-state={archive.listState}>
          <span aria-hidden="true">◇</span>
          <h3>{archive.listState === "error" ? "暂时无法读取本机档案" : "尚未留下旅程记录"}</h3>
          {archive.listState === "ready" && onNewGame && <ArchiveAction label="新的开始" disabled={archive.busy} onClick={onNewGame}>新的开始</ArchiveAction>}
          {archive.listState === "error" && <ArchiveAction label="重新读取档案" disabled={archive.busy} onClick={() => void archive.refresh()}>重新读取</ArchiveAction>}
        </div>}
        {archive.listState === "loading" && <span className="save-slots__loading-status" role="status" aria-label="正在读取档案" />}
      </div>
    {view !== "list" && <div className="title-archive__utility" role="region" aria-label={heading}>
      <h2 ref={headingRef} tabIndex={-1}>{heading}</h2>
      <button className="abyssa-system-records__text-button" onClick={back} disabled={archive.busy}>关闭</button>
      {view === "import" ? <div className="title-archive__utility-columns"><section>
        <label className="abyssa-system-records__field">导入格式<select value={importFormat} disabled={archive.busy} onChange={event => setImportFormat(event.target.value as typeof importFormat)}>
          <option value="application">Abyssa 档案（复制为新档）</option><option value="restore">AIRP 备份恢复（原身份）</option><option value="legacy">旧版战斗存档</option>
        </select></label>
        <input ref={fileInput} className="abyssa-system-records__file" type="file" aria-label="导入存档" accept=".json,application/json" disabled={archive.busy}
          onChange={event => {const file = event.target.files?.[0]; if (file) void archive.importGame(file, importFormat); event.target.value = "";}} />
        <ArchiveAction label="选择档案文件" disabled={archive.busy} onClick={() => fileInput.current?.click()}>选择文件</ArchiveAction>
      </section><aside><h3>JSON · 最大 8 MiB</h3><p>{importFormat === "restore" ? "原身份恢复会校验本机进度；存在冲突时不会覆盖。" : "普通导入会建立独立档案，不覆盖现有旅程。"}</p></aside></div> : <div className="title-archive__utility-columns"><section>
        <h3>所选档案</h3>
        {selected ? <>
          <p>{selected.status === "ready" ? `${selected.presentation?.playerName ?? "未命名旅程"} · ${saveScene(selected).title}` : "此档案暂不可读取，原始数据仍保留。"}</p>
          <p className="abyssa-system-records__identity">{selected.saveId}</p>
          <div className="abyssa-system-records__actions">
            {selected.status === "ready" && <ArchiveAction label="导出存档" disabled={archive.busy} onClick={() => void archive.exportGame(selected.saveId)}>导出存档</ArchiveAction>}
            {archive.archivedIds.has(selected.saveId) && <ArchiveAction label="恢复档案" disabled={archive.busy} onClick={() => void archive.restore(selected.saveId)}>恢复档案</ArchiveAction>}
            <button className="abyssa-system-records__text-button" disabled={archive.busy} onClick={() => void archive.exportGame(selected.saveId, true)}>导出诊断</button>
          </div>
          {selected.status === "ready" && <div className="abyssa-system-records__actions">
            {selected.summary.continuation?.upgrade && <button className="abyssa-system-records__text-button" disabled={archive.busy || !!selected.summary.activeExpeditionId} onClick={() => void archive.continueSave(selected, "upgrade")}>复制并续接新内容</button>}
            {selected.summary.continuation?.cycle && <button className="abyssa-system-records__text-button" disabled={archive.busy || !!selected.summary.activeExpeditionId} onClick={() => void archive.continueSave(selected, "cycle")}>新周目（仅继承回忆）</button>}
          </div>}
        </> : <p>没有已选档案。</p>}
      </section><aside><section><h3>整理与备份</h3><p>仅隐藏已续接旧档，不删除进度，可随时恢复。</p>
          <div className="abyssa-system-records__actions"><button className="abyssa-system-records__text-button" disabled={archive.busy} onClick={() => void archive.cleanup()}>整理已续接旧档</button>
            {archive.archivedIds.size > 0 && <button className="abyssa-system-records__text-button" disabled={archive.busy} aria-pressed={archive.showArchived}
              onClick={() => { archive.setShowArchived(!archive.showArchived); setView("list"); }}>{archive.showArchived ? "隐藏已归档" : `显示已归档（${archive.archivedIds.size}）`}</button>}
            <button className="abyssa-system-records__text-button" disabled={archive.busy} onClick={() => void archive.refresh()}>重新读取档案</button>
          </div>
        </section>
        <details className="abyssa-system-records__advanced"><summary>开发与兼容工具</summary><p>AIRP 联机测试需要连接本机 rp；普通的新旅程无需后端。</p>
          <button className="abyssa-system-records__text-button" disabled={archive.busy} onClick={() => void archive.newGame(10)}>新建 AIRP 联机档（内容10）</button>
        </details>
      </aside></div>}
    </div>}

    </div>
  </SystemPanel>{feedback.layer}</>;
}
