import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SceneTransition } from "../shared/transition/SceneTransition";
import { SceneTransitionContext } from "../shared/transition/TransitionProvider";
import type { SceneNavigationOptions, SceneTransitionCopy, SceneTransitionPhase } from "../shared/transition/types";
import { bindNavigator, isGameTarget, readRoute, routeHref, type RouteLocation } from "../shared/routing/location";
import { prepareGame } from "../shared/loading/startup";
import { loadImage } from "../shared/loading/images";
import { loadRoute, routeTitles, type RouteModule } from "./routes";

const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    if (signal.aborted) finish(); else signal.addEventListener("abort", finish, {once:true});
  });
}
type MountedRoute = RouteLocation & { module: RouteModule; key: number };
type NavigationMode = "push" | "replace" | "history" | "boot";

/** One document, one active page, one curtain. Cached modules never keep a page mounted. */
export function GameShell() {
  const [current, setCurrent] = useState<MountedRoute | null>(null);
  const [phase, setPhase] = useState<SceneTransitionPhase>("closed");
  const [copy, setCopy] = useState<SceneTransitionCopy>({channel:"正在准备",destination:"旅程即将开始"});
  const [progress, setProgress] = useState<number | undefined>(0);
  const [error, setError] = useState<string>();
  const retry = useRef<() => void>(() => {});
  const phaseRef = useRef(phase);
  const currentRef = useRef(current);
  const sequence = useRef(0);
  const pendingHref = useRef("");
  const incoming = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const readiness = useMemo(() => {
    const holds = new Set<symbol>();
    const waiting = new Set<() => void>();
    return {
      hold: () => {
        const token = Symbol(); holds.add(token);
        return () => { holds.delete(token); if (!holds.size) { waiting.forEach(done => done()); waiting.clear(); } };
      },
      wait: (signal: AbortSignal) => !holds.size || signal.aborted ? Promise.resolve() : new Promise<void>(resolve => {
        const done = () => { waiting.delete(done); signal.removeEventListener("abort", done); resolve(); };
        waiting.add(done); signal.addEventListener("abort", done, {once:true});
      }),
    };
  }, []);
  const updatePhase = useCallback((next: SceneTransitionPhase) => { phaseRef.current = next; setPhase(next); }, []);

  const enter = useCallback(async (url: URL, mode: NavigationMode, options: SceneNavigationOptions = {}) => {
    const route = readRoute(url);
    if (!route) return;
    const id = ++sequence.current;
    operation.current?.abort();
    const controller = new AbortController(); operation.current = controller;
    const {signal} = controller;
    const stale = () => sequence.current !== id;
    pendingHref.current = url.href;
    retry.current = () => { void enter(url, mode, options); };
    setError(undefined);
    try {
      if (mode === "boot") {
        updatePhase("closed");
        await prepareGame(state => {
          if (!stale()) setProgress(Math.min(99, Math.floor(100 * state.loadedBytes / Math.max(1, state.totalBytes))));
        });
      } else {
        setProgress(undefined);
        setCopy({destination:routeTitles[route.page],channel:"正在前往",...options});
        // Data gates can redirect while the curtain is closed (unfinished prologue, etc.).
        if (phaseRef.current !== "closed") {
          incoming.current = false;
          updatePhase("closing");
          await pause(560, signal);
        }
      }
      if (stale()) return;
      updatePhase("closed");
      const module = await loadRoute(route.page);
      if (stale()) return;
      incoming.current = true;
      setProgress(undefined);
      // The old React tree is unmounted in this commit: WebGL/RAF/readers release ownership
      // before effects from the new page start. Only inert modules and decoded assets persist.
      flushSync(() => {
        if (mode !== "history") {
          const href = window.location.pathname + routeHref(route.page, route.search);
          if (mode === "push") history.pushState(null, "", href); else history.replaceState(null, "", href);
        }
        document.documentElement.dataset.gamePage = route.page;
        document.title = routeTitles[route.page];
        const mounted = {...route,module,key:id}; currentRef.current = mounted; setCurrent(mounted);
      });
      // Data readiness is not timed out. Image decoding is bounded and shares the LRU cache.
      await paint(); await readiness.wait(signal);
      if (stale()) return;
      await paint(); await readiness.wait(signal);
      if (stale()) return;
      const visualTimer = new AbortController();
      const abortVisual = () => visualTimer.abort(); signal.addEventListener("abort", abortVisual, {once:true});
      await Promise.race([
        Promise.all(Array.from(document.images).filter(img => img.src || img.currentSrc)
          .map(img => loadImage(img.currentSrc || img.src, img).catch(() => undefined))),
        pause(6_000, visualTimer.signal),
      ]);
      visualTimer.abort(); signal.removeEventListener("abort", abortVisual);
      if (stale()) return;
      updatePhase("opening");
      await pause(route.page === "battle" || route.page === "shop" ? 1_850 : 620, signal);
      if (stale()) return;
      incoming.current = false; pendingHref.current = ""; updatePhase("idle");
    } catch (cause) {
      if (stale()) return;
      console.error("[ABYSSA scene preparation]", cause);
      setCopy({channel:"准备暂时中断",destination:routeTitles[route.page]});
      setError("连接未完成，请重试。");
      updatePhase("closed");
    }
  }, [readiness, updatePhase]);

  const navigate = useCallback((target: string, options: SceneNavigationOptions = {}) => {
    const url = new URL(target, window.location.href);
    if (!isGameTarget(url)) {
      if (options.replace) window.location.replace(url.href); else window.location.assign(url.href);
      return true;
    }
    if (url.href === pendingHref.current) return false;
    if (phaseRef.current !== "idle" && !(options.replace && phaseRef.current === "closed")) return false;
    void enter(url, options.replace ? "replace" : "push", options);
    return true;
  }, [enter]);

  useEffect(() => {
    let cancelled = false;
    // React StrictMode's discarded mount must not launch a second preparation pass.
    queueMicrotask(() => {
      if (cancelled) return;
      const url = new URL(window.location.href);
      if (!url.hash || !readRoute(url)) url.hash = `/${import.meta.env.VITE_GAME_HOME || "title"}${url.search}`;
      void enter(url, "boot");
    });
    const unbind = bindNavigator(navigate);
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self") return;
      if (!isGameTarget(new URL(anchor.href))) return;
      event.preventDefault(); navigate(anchor.href);
    };
    const historyChange = () => {
      const url = new URL(window.location.href), route = readRoute(url), active = currentRef.current;
      if (!route || pendingHref.current === url.href || !pendingHref.current && active?.page === route.page && active.search === route.search) return;
      void enter(url, "history");
    };
    document.addEventListener("click", click);
    window.addEventListener("popstate", historyChange);
    window.addEventListener("hashchange", historyChange);
    return () => {
      cancelled = true; sequence.current++; operation.current?.abort(); unbind();
      document.removeEventListener("click", click);
      window.removeEventListener("popstate", historyChange);
      window.removeEventListener("hashchange", historyChange);
    };
  }, [enter, navigate]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (phase !== "idle") root.dataset.sceneTransition = phase; else delete root.dataset.sceneTransition;
    if (incoming.current) { root.dataset.sceneIncoming = ""; root.dataset.sceneReveal = current?.page === "battle" || current?.page === "shop" ? "panel-drop" : "fade"; }
    else { delete root.dataset.sceneIncoming; delete root.dataset.sceneReveal; }
    if (phase !== "idle") document.body.setAttribute("aria-busy", "true"); else document.body.removeAttribute("aria-busy");
    return () => { delete root.dataset.sceneTransition; delete root.dataset.sceneIncoming; delete root.dataset.sceneReveal; document.body.removeAttribute("aria-busy"); };
  }, [phase, current]);

  const context = useMemo(() => ({phase,isTransitioning:phase !== "idle",navigate,holdReady:readiness.hold}), [phase,navigate,readiness]);
  const Page = current?.module.default;
  return <SceneTransitionContext.Provider value={context}>
    {Page && <Page key={current!.key}/>}
    <SceneTransition phase={phase} {...copy} progress={progress} error={error} onRetry={() => retry.current()}/>
  </SceneTransitionContext.Provider>;
}
