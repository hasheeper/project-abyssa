import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { aiConfiguration, effectiveAiConfiguration } from "../../game-runtime/airp-configuration";
import { createDirectGameDriver, hash, inspectDirectAttempt, exportDirectDiagnostic, type DirectPlayerPort } from "../../game-runtime/airp-direct-driver";
import { useGameSession, useGameState, downloadJson } from "../react";
import type { GameSession } from "../session";
import { useAiSettingsScene } from "../settings/AiSettingsButton";
import { directConnectionIssue, directProgressFacts } from "../../game-runtime/airp-direct-progress";
import { directElapsed, stageLabelsFor, projectDirectProgress } from "./direct-progress";
import { InlineFeedback, FeedbackActionButton } from "../../shared/ui/patterns/SceneFeedback";
import { GameOperationFeedback } from "../GameOperationFeedback";
import { JournalButton } from "../JournalPrimitives";
import { ConfirmationDialog } from "../../shared/ui/patterns/ConfirmationDialog";
import { SceneLayer } from "../SceneLayer";
import "./direct-game.css";

const drivers = new WeakMap<GameSession, ReturnType<typeof createDirectGameDriver>>();
function driverFor(session: GameSession) {
  let driver = drivers.get(session);
  if (!driver) {driver = createDirectGameDriver(); drivers.set(session, driver);}
  return driver;
}
export function organizeDirectMemory(session: GameSession, sceneId: string) {
  const config = effectiveAiConfiguration(aiConfiguration.getSnapshot());
  return driverFor(session).run(directPlayerPort(session), sceneId, "update", config.material, config);
}
export function directPlayerPort(session: GameSession): DirectPlayerPort {
  return {
    async read() {
      if (session.getSnapshot().status === "disposed") throw Error("disposed");
      const r = await session.runtime.application.open(session.locator.saveId);
      if (!r.ok || r.record.schemaVersion !== 4 || !r.record.airpDirect || r.record.head.epoch !== session.locator.epoch) throw Error("save-changed");
      return r.record;
    },
    async commit(command) {
      if (session.getSnapshot().status === "disposed") throw Error("disposed");
      await session.refresh({background: true});
      if (session.getSnapshot().status !== "ready") throw Error("not-ready");
      const current = session.getSnapshot().record;
      // Refresh may already have recovered this exact locally pending command.
      if (current?.schemaVersion === 4 && current.facts.some(f => f.kind === "airp-direct" && hash(f.payload.command) === hash(command))) return current;
      const batch = await session.dispatch(command);
      if (!batch || batch.after.schemaVersion !== 4 || !batch.receipts.some(r => r.version === 4 && r.airpDirect && hash(r.airpDirect.command) === hash(command))) throw Error("commit-not-saved");
      return batch.after;
    },
  };
}
function useDirectProgress(sceneId: string) {
  const session = useGameSession(), {record, status} = useGameState();
  const driver = useMemo(() => driverFor(session), [session]);
  const state = useSyncExternalStore(driver.subscribe, driver.getSnapshot);
  const config = useSyncExternalStore(aiConfiguration.subscribe, aiConfiguration.getSnapshot);
  const port = useMemo(() => directPlayerPort(session), [session]);
  useEffect(() => () => {queueMicrotask(() => {if (session.getSnapshot().status === "disposed") driver.cancel();});}, [session, driver]);
  useEffect(() => {
    if (!state.pendingResult) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = "";};
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.pendingResult]);
  const direct = record?.schemaVersion === 4 ? record.airpDirect : undefined, task = direct?.tasks.find(t => t.sceneId === sceneId);
  const validRecord = record?.schemaVersion === 4 && record.narrative?.version === 2 ? record : null;
  const facts = task && validRecord ? directProgressFacts(validRecord, task) : null;
  const resourceVersion = task?.materialHash ? direct?.materials[task.materialHash]?.resources.version ?? 4 : 5;
  const view = facts && validRecord && task ? projectDirectProgress(facts, state, status === "ready", directConnectionIssue(validRecord, task, config), resourceVersion) : null;
  const run = (mode: "generate" | "update") => {const e = effectiveAiConfiguration(config); void driver.run(port, sceneId, mode, e.material, e);};
  return {session, record: validRecord, task, facts, state, view, driver, port, run, status};
}

/** Only this leaf ticks; it never reads a save or rebuilds model input. */
function Elapsed({since}: {since: number}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer);}, [since]);
  return <span className="airp-direct-elapsed">已等待 {directElapsed(since, now)}</span>;
}

export function DirectControls({sceneId}: {sceneId: string}) {
  const {session, record, task, facts, state, view, driver, port, run, status} = useDirectProgress(sceneId);
  const [inspection, setInspection] = useState("");
  const [confirm, setConfirm] = useState(false), [confirmationPresent, setConfirmationPresent] = useState(false), [choosing, setChoosing] = useState(false), [choiceError, setChoiceError] = useState("");
  const settings = useAiSettingsScene(), handwrite = useRef<HTMLButtonElement>(null);
  useEffect(() => {setInspection(""); setConfirm(false); setChoiceError("");}, [sceneId]);
  if (!task || !record || !facts || !view) return null;
  const labels = stageLabelsFor(task.materialHash ? record.airpDirect!.materials[task.materialHash].resources.version : 5);
  const primary = () => {
    if (view.primary === "settings") settings.show();
    else if (view.primary === "save") void driver.retryCommit(port);
    else if (view.primary) run(view.primary);
  };
  const chooseHandwritten = async () => {
    if (!view.canHandwrite || driver.getSnapshot().busy || driver.getSnapshot().pendingResult || choosing) return;
    setChoosing(true); setChoiceError("");
    try {
      const result = await session.dispatch({type: "airp-direct-handwritten", sceneId});
      if (result) setConfirm(false); else setChoiceError("来源尚未切换，请核对存档状态后重试。");
    } catch {setChoiceError("来源尚未切换，请核对存档状态后重试。");}
    finally {setChoosing(false);}
  };
  const attemptStates = {running: "结果待确认", succeeded: "已保存", failed: "未通过", interrupted: "已中断"};
  return <section className="airp-direct-progress" aria-label="AIRP 直连任务" data-tone={view.tone}>
    {task.source !== "handwritten" && <ol className="airp-direct-rail" aria-label="三阶段生成进度">{view.rail.map((step, i) => <li key={step.stage} data-state={step.status} aria-current={step.status === "进行中" || step.status === "保存中" ? "step" : undefined}>
      <span className="airp-direct-rail__index" aria-hidden="true">{step.status === "已保存" ? "✓" : `0${i + 1}`}</span><span>{step.label}<small>{step.status}</small></span>
    </li>)}</ol>}
    <GameOperationFeedback session={session} state={session.getSnapshot()} local/>
    {!session.getSnapshot().error && (view.tone === "warning" ? <InlineFeedback tone="warning" message={[view.title, view.note].filter(Boolean).join("。")} details={view.detailError ? {id: view.detailError, raw: view.detailError} : undefined}/>
      : <div className="airp-direct-status" role="status" aria-atomic="true"><p className="airp-direct-status__title">{view.title}</p>{view.note && <p className="airp-direct-note">{view.note}</p>}</div>)}
    {view.clockSince !== null && <Elapsed since={view.clockSince}/>}
    <div className="airp-direct-actions">
      {view.primary && <FeedbackActionButton label={view.primaryLabel} onClick={primary}>{view.primary === "save" ? "重试保存" : view.primaryLabel}</FeedbackActionButton>}
      {view.cancelLabel && <JournalButton onClick={() => driver.cancel()}>{view.cancelLabel}</JournalButton>}
      {facts.generating && <JournalButton ref={handwrite} disabled={!view.canHandwrite} onClick={() => setConfirm(true)}>使用手写稿</JournalButton>}
      {view.canExportPending && <JournalButton onClick={() => downloadJson(driver.exportPending(), "airp-unsaved-output.json")}>导出未保存输出</JournalButton>}
    </div>
    {(facts.generating || facts.canUpdate) && view.primary !== "settings" && <JournalButton onClick={settings.show}>前往设置</JournalButton>}
    {settings.scene}
    <details className="airp-direct-details airp-direct-diagnostics"><summary>技术详情 · 输入与输出记录</summary>

      <p className="airp-direct-note">阶段与阅读进度自动保存。此处核对隐藏连接地址，不含 Key；完整存档仍可能包含端点，分享前请检查。</p>
      <p>{task.context?.sourceKind ?? "尚未冻结"} · {task.context?.proof.outcome ?? ""}</p>
      {task.attempts.map(a => <details key={a.id}><summary>{labels[a.stage]} #{a.ordinal} · {attemptStates[a.status]}</summary>
      <p>tokens {a.usage.totalTokens ?? "未知"}{a.endedAt !== null ? ` · 用时 ${directElapsed(a.startedAt, a.endedAt)}` : ""}</p>
      <p>输入SHA256：{a.inputHash}</p><JournalButton onClick={() => {
        try {setInspection(JSON.stringify(inspectDirectAttempt(record, sceneId, a.id), (key, value) => key === "baseUrl" ? "[连接地址仅在设置显示]" : value, 2));}
        catch {setInspection("输入重建与原哈希不一致，拒绝显示为原请求。");}
      }}>核对完整输入与输出</JournalButton><pre>{a.output ?? "没有输出"}</pre></details>)}
      {inspection && <><pre aria-label="完整请求核对">{inspection}</pre><JournalButton onClick={() => downloadJson(inspection, "airp-attempt-inspection.json")}>导出此阶段核对记录</JournalButton></>}
      <JournalButton onClick={() => {try {downloadJson(exportDirectDiagnostic(record), "airp-redacted-diagnostic.json");} catch {setInspection("输入未能按原哈希重建，无法导出已验证诊断。请保留完整存档供本机排查。");}}}>导出脱敏诊断（不能恢复存档）</JournalButton>
    </details>
    <SceneLayer active={confirm || confirmationPresent}><ConfirmationDialog open={confirm} title="本场改用手写稿？" description="选定后，本场不能再切回AI生成。迟到的模型结果不会替换手写稿。" confirmLabel="使用手写稿" onPresentChange={setConfirmationPresent}
      busy={choosing || state.busy || state.pendingResult || status !== "ready"} onConfirm={() => void chooseHandwritten()} onCancel={() => setConfirm(false)} returnFocusRef={handwrite}>
      {choiceError && <InlineFeedback message={choiceError}/>}
    </ConfirmationDialog></SceneLayer>
  </section>;
}

/** A persistent summary outside the folded history. */
export function DirectRecord({sceneId, label = "AIRP · 生成记录", docked = false}: {sceneId: string; label?: string; docked?: boolean}) {
  const {view, task} = useDirectProgress(sceneId), details = useRef<HTMLDetailsElement>(null), summary = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  if (!view || !task) return null;
  const needsAttention = view.primary || view.cancelLabel || view.canExportPending;
  return <div className={`airp-direct-record${docked ? " airp-direct-record--docked" : ""}`}>
    {(task.read || view.tone !== "quiet") && <div className="airp-direct-memory" data-tone={view.tone}>
      <span role={expanded ? undefined : "status"}>{view.title}</span>
      {needsAttention && !expanded && <JournalButton onClick={() => {if (details.current) details.current.open = true; summary.current?.focus();}}>查看处理选项</JournalButton>}
    </div>}
    <details className={docked ? "airp-story-tools" : "airp-direct-details"} ref={details} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary ref={summary}>{label}</summary><div className={docked ? "airp-story-tools__panel" : undefined}><DirectControls sceneId={sceneId}/></div>
    </details>
  </div>;
}
