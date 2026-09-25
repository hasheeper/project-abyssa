import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { ConfirmationDialog } from "../shared/ui/patterns/ConfirmationDialog";
import { InlineFeedback, SceneFeedback, type SceneFeedbackEntry } from "../shared/ui/patterns/SceneFeedback";

const OverlayContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);
/** Direct Stage child: never inherit the right panel's offset/clipping. */
export function ArchiveOverlayScope({children}: {children: ReactNode}) {
  const [overlay, setOverlay] = useState<ReactNode>(null);
  return <OverlayContext.Provider value={setOverlay}>{children}{overlay}</OverlayContext.Provider>;
}
function ArchiveOverlay({children}: {children: ReactNode}) {
  const setOverlay = useContext(OverlayContext);
  useLayoutEffect(() => { setOverlay?.(children); }, [setOverlay, children]);
  useLayoutEffect(() => () => setOverlay?.(null), [setOverlay]);
  return setOverlay ? null : children;
}

type Confirmation = { title: string; description: string; label: string; work: () => Promise<string>; refresh?: () => void };
export function useArchiveFeedback() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState<SceneFeedbackEntry | null>(null);
  const locked = useRef(false), alive = useRef(true), serial = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function submit() {
    if (!confirmation || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const message = await confirmation.work();
      if (alive.current) { setOpen(false); setNotice({id: `archive-${++serial.current}`, kind: "notice", tone: "success", message}); }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "操作未完成，请重试。");
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return {
    blocked: open || present || busy,
    ask(value: Confirmation) {
      if (locked.current || open || present) return;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setError(""); setNotice(null); setConfirmation(value); setOpen(true);
    },
    notify(message: string) { setNotice({id: `archive-${++serial.current}`, kind: "notice", tone: "success", message}); },
    layer: <ArchiveOverlay>
      <ConfirmationDialog open={open} title={confirmation?.title ?? "档案操作"} description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.label} tone="danger" busy={busy} onConfirm={() => void submit()}
        onCancel={() => { if (!locked.current) { setOpen(false); setError(""); } }} onPresentChange={setPresent} returnFocusRef={returnFocus}>
        {error && <InlineFeedback message={error} action={confirmation?.refresh ? {label: "刷新档案", onClick: () => {
          if (locked.current) return;
          setOpen(false); setError(""); confirmation.refresh?.();
        }} : undefined} />}
      </ConfirmationDialog>
      <SceneFeedback className="archive-feedback" entry={!open && !present ? notice : null} onDismiss={id => setNotice(current => current?.id === id ? null : current)} />
    </ArchiveOverlay>,
  };
}
