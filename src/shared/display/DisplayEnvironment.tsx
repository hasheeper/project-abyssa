import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFullscreen } from "./fullscreen";
import "./display.css";

const DisplayContext = createContext(false);
const portraitQuery = "(orientation: portrait) and (hover: none) and (pointer: coarse)";

/** One document-level display host, shared by the shell and the standalone settings entry. */
export function DisplayEnvironment({ children }: { children: ReactNode }) {
  const hosted = useContext(DisplayContext);
  return hosted ? children : <DisplayContext.Provider value={true}><DisplayHost />{children}</DisplayContext.Provider>;
}

function DisplayHost() {
  useFullscreen();
  const [portrait, setPortrait] = useState(() => window.matchMedia?.(portraitQuery).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(portraitQuery);
    if (!media) return;
    const update = () => setPortrait(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!portrait) return;
    const root = document.getElementById("root");
    if (!root) return;
    const wasInert = root.inert;
    root.inert = true;
    return () => { root.inert = wasInert; };
  }, [portrait]);

  useEffect(() => {
    let pointerInput = false;
    const clearFocusMarker = () => document.querySelectorAll("[data-native-pointer-focus]").forEach(node => node.removeAttribute("data-native-pointer-focus"));
    const pointer = () => { pointerInput = true; };
    const keyboard = () => { pointerInput = false; clearFocusMarker(); };
    const focus = (event: FocusEvent) => {
      const node = event.target;
      if (pointerInput && node instanceof HTMLElement && node.closest(".abyssa-stage") && getComputedStyle(node).outlineStyle === "auto") {
        // Only the browser's automatic outline. Authored solid/dashed game borders stay intact.
        node.setAttribute("data-native-pointer-focus", "");
      }
    };
    const drag = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest(".abyssa-stage") && event.target.closest("img, a")) event.preventDefault();
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", clearFocusMarker);
    document.addEventListener("dragstart", drag);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", clearFocusMarker);
      document.removeEventListener("dragstart", drag);
      clearFocusMarker();
    };
  }, []);

  return portrait ? createPortal(<div className="game-orientation" role="status" aria-live="polite">
    <svg className="game-orientation__phone" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <rect x="25" y="13" width="30" height="54" rx="5" stroke="currentColor" strokeWidth="2" transform="rotate(-35 40 40)" />
      <path d="M63 23a30 30 0 0 1 5 34m-1-9 1 9 8-4M17 57a30 30 0 0 1-5-34m1 9-1-9-8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <h1>请旋转至横屏</h1>
    <p>ABYSSA 仅支持手机横屏游玩</p>
    <span>关闭系统的竖屏锁定后，横置手机即可继续</span>
  </div>, document.body) : null;
}
