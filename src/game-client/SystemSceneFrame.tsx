import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { modalFocusables, useModalPresentation } from "../shared/ui/primitives/useModalPresentation";
import "./system-scene.css";

/** Shared full-Stage surface. Hosts own their choreography; this owns input/focus. */
export function SystemSceneFrame({ root, className, title, present, interactive, reduced, onClose, onPresentChange, children }: {
  root: RefObject<HTMLDivElement | null>; className: string; title: string; present: boolean; interactive: boolean; reduced: boolean;
  onClose: () => void; onPresentChange?: (present: boolean) => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useModalPresentation(panel, root, present, undefined, onPresentChange);
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const nodes = panel.current ? modalFocusables(panel.current) : [];
    const first = nodes[0], last = nodes.at(-1), active = document.activeElement;
    if (!first) { event.preventDefault(); panel.current?.focus({ preventScroll: true }); }
    else if (event.shiftKey && (active === first || active === panel.current)) { event.preventDefault(); last?.focus({ preventScroll: true }); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
  }
  return <div ref={root} className={`system-scene ${className}`} data-ui-modal-present="" data-open={present} data-ui-motion={reduced ? "reduced" : "full"}>
    <div className={`system-scene__backdrop ${className}__backdrop`} aria-hidden="true" />
    <div ref={panel} className={`system-scene__panel ${className}__scene`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={keyDown}>
      <div className={`system-scene__interaction ${className}__interaction`} inert={!interactive || !present}>{children}</div>
    </div>
  </div>;
}

export function SystemSceneHeading({ label, description }: { label: string; description: string }) {
  return <h1 className="system-scene__heading"><span>{description}</span><strong>{label}</strong></h1>;
}
