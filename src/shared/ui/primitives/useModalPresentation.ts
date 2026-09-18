import { useLayoutEffect, useRef, type RefObject } from "react";

export const MODAL_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
export function modalFocusables(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).filter(node =>
    node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest("[inert]") &&
    (node.offsetParent !== null || node === document.activeElement));
}

/** Focus/input ownership lasts until real removal, not merely open=false. */
export function useModalPresentation(
  panelRef: RefObject<HTMLDivElement | null>, rootRef: RefObject<HTMLDivElement | null>,
  present: boolean, returnFocusRef?: RefObject<HTMLElement | null>, onPresentChange?: (present: boolean) => void
) {
  const current = useRef({ present, onPresentChange });
  const restoreFrame = useRef<number | undefined>(undefined);
  const source = useRef<HTMLElement | null>(null);
  const inertChildren = useRef(new Map<HTMLElement, boolean>());
  useLayoutEffect(() => { current.current = { present, onPresentChange }; });

  useLayoutEffect(() => {
    const panel = panelRef.current, root = rootRef.current;
    if (!panel || !root) return;
    if (restoreFrame.current !== undefined) cancelAnimationFrame(restoreFrame.current);
    const host = root.closest<HTMLElement>(".abyssa-stage__canvas") ?? root.parentElement;
    if (!source.current) source.current = returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const topmost = () => [...document.querySelectorAll<HTMLElement>("[data-ui-modal-present]")]
      .filter(node => !node.closest("[inert]")).at(-1) === root;
    const focusInside = () => (current.current.present ? modalFocusables(panel)[0] ?? panel : panel).focus({ preventScroll: true });
    // Capturing at window also catches background document/window shortcuts.
    const guard = (event: Event) => {
      if (!topmost()) return;
      if (!current.current.present || !(event.target instanceof Node) || !root.contains(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === "keydown") focusInside();
      }
    };
    const focus = (event: FocusEvent) => {
      if (topmost() && event.target instanceof Node && !root.contains(event.target)) focusInside();
    };
    const guardedEvents = ["keydown", "keyup", "pointerdown", "pointerup", "mousedown", "mouseup", "click", "submit"];
    for (const name of guardedEvents) window.addEventListener(name, guard, true);
    document.addEventListener("focusin", focus, true);
    current.current.onPresentChange?.(true);
    // Transfer focus in the same commit so a fast Escape reaches this modal,
    // rather than being swallowed as a background key before the first RAF.
    if (topmost() && !panel.contains(document.activeElement)) focusInside();
    const focusFrame = requestAnimationFrame(() => {
      if (topmost() && !panel.contains(document.activeElement)) focusInside();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      for (const name of guardedEvents) window.removeEventListener(name, guard, true);
      document.removeEventListener("focusin", focus, true);
      current.current.onPresentChange?.(false);
      restoreFrame.current = requestAnimationFrame(() => {
        // Route removal or another modal must not restore focus to an old page.
        if (!host?.isConnected || document.querySelector("[data-ui-modal-present]")) return;
        const target = source.current;
        if (target?.isConnected && !target.closest("[inert],[hidden]") && !target.matches(":disabled") &&
          (target.checkVisibility?.({ visibilityProperty: true }) ?? getComputedStyle(target).display !== "none")) {
          target.focus({ preventScroll: true });
        } else if (!host.closest("[inert]")) {
          const fallback = modalFocusables(host)[0];
          if (fallback) fallback.focus({ preventScroll: true });
          else {
            const tabIndex = host.getAttribute("tabindex");
            host.tabIndex = -1; host.focus({ preventScroll: true });
            if (tabIndex === null) host.removeAttribute("tabindex"); else host.setAttribute("tabindex", tabIndex);
          }
        }
        source.current = null;
      });
    };
  }, [panelRef, rootRef, returnFocusRef]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!present) {
      panel.focus({ preventScroll: true });
      for (const child of panel.children) if (child instanceof HTMLElement) {
        inertChildren.current.set(child, child.hasAttribute("inert"));
        child.setAttribute("inert", "");
      }
    } else {
      for (const [child, inert] of inertChildren.current) child.toggleAttribute("inert", inert);
      if (inertChildren.current.size) (modalFocusables(panel)[0] ?? panel).focus({ preventScroll: true });
      inertChildren.current.clear();
    }
  }, [present, panelRef]);
}
