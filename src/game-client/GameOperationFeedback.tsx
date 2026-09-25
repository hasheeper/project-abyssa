import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmationDialog } from "../shared/ui/patterns/ConfirmationDialog";
import { ErrorDetails } from "../shared/ui/patterns/feedback/ErrorDetails";
import { downloadJson, gameErrorText } from "./game-errors";
import { JournalButton } from "./JournalPrimitives";
import { SceneLayer } from "./SceneLayer";
import type { GameSession, SessionState } from "./session";
import "./game-operation-feedback.css";

type Report = {id: string; session: GameSession; error: SessionState["error"]; local: boolean; anchor: Element | null; managed?: boolean};
type FeedbackOwner = {
  report: (id: string, value: Report | null) => void;
  selectedId?: string;
  dismissed: boolean;
  reopen: () => void;
};
const Ownership = createContext<FeedbackOwner | null>(null);

/** One error presenter per session scope. Local surfaces report context, not
 * nested windows; a global reporter is only the fallback for the same error. */
export function GameFeedbackScope({children}: {children: ReactNode}) {
  const [reports, setReports] = useState<Map<string, Report>>(() => new Map());
  const [dismissed, setDismissed] = useState<SessionState["error"]>(null);
  const report = useCallback((id: string, value: Report | null) => setReports(current => {
    const next = new Map(current);
    if (value) next.set(id, value); else next.delete(id);
    return next;
  }), []);
  const failures = [...reports.values()].filter(item => item.error);
  const selected = failures.find(item => item.local && !item.managed) ?? failures.find(item => item.local) ?? failures[0] ?? null;
  const reopen = useCallback(() => setDismissed(null), []);
  const closed = !!selected && selected.error === dismissed;
  const owner = useMemo(() => ({report, selectedId: selected?.id, dismissed: closed, reopen}), [report, selected?.id, closed, reopen]);
  return <Ownership.Provider value={owner}>{children}
    <OperationDialog current={selected?.managed ? null : selected} open={!!selected && !selected.managed && !closed} onClose={() => setDismissed(selected?.error ?? null)}/>
  </Ownership.Provider>;
}

export function GameOperationFeedback({session, state, local = false, managed = false}: {session: GameSession; state: SessionState; local?: boolean; managed?: boolean}) {
  const owner = useContext(Ownership), report = owner?.report;
  const id = useId(), anchor = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { report?.(id, {id, session, error: state.error, local, managed, anchor: anchor.current}); }, [report, id, session, state.error, local, managed]);
  useLayoutEffect(() => () => report?.(id, null), [report, id]);
  if (!owner) return <GameFeedbackScope><GameOperationFeedback session={session} state={state} local={local} managed={managed}/></GameFeedbackScope>;
  return <><span ref={anchor} hidden/>{!managed && owner.selectedId === id && owner.dismissed && <JournalButton onClick={owner.reopen}>查看错误</JournalButton>}</>;
}

function OperationDialog({current, open, onClose}: {current: Report | null; open: boolean; onClose: () => void}) {
  const retained = useRef<Report | null>(null);
  if (current) retained.current = current;
  const source = current ?? retained.current;
  const [present, setPresent] = useState(false), [busy, setBusy] = useState(false), [exportError, setExportError] = useState("");
  const locked = useRef(false);
  useLayoutEffect(() => setExportError(""), [source?.error]);
  if (!source?.error) return null;
  const {session, error, anchor} = source;
  const work = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setExportError("");
    try { await action(); }
    catch { setExportError("操作未完成，请稍后重试。"); }
    finally { locked.current = false; setBusy(false); }
  };
  return <SceneLayer active={open || present} anchor={anchor}>
    <ConfirmationDialog open={open} title="操作未完成" description={gameErrorText(error.code)}
      confirmLabel="重新读取" cancelLabel="关闭" busyLabel="处理中…" busy={busy}
      onConfirm={() => void work(() => session.refresh())} onCancel={onClose} onPresentChange={setPresent}>
      <div className="game-operation-details">
        <ErrorDetails key={error.message} details={{id: error.code, code: error.code, raw: error.message}}>
          <JournalButton disabled={busy} onClick={() => void work(async () => {
            const result = await session.runtime.application.exportDiagnostic(session.locator.saveId);
            if (!result.ok) throw new Error("Diagnostic export failed");
            downloadJson(result.archive, `abyssa-diagnostic-${session.locator.saveId}.json`);
          })}>导出诊断</JournalButton>
        </ErrorDetails>
        {exportError && <p role="alert">{exportError}</p>}
      </div>
    </ConfirmationDialog>
  </SceneLayer>;
}
