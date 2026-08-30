import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { SceneTransition } from "./SceneTransition";
import type {
  SceneNavigationOptions,
  SceneTransitionCopy,
  SceneTransitionPhase,
  SceneRevealMode
} from "./types";

const HANDOFF_KEY = "abyssa:scene-handoff:v1";
const HANDOFF_TTL_MS = 15_000;
const CLOSE_MS = 560;
const FADE_OPEN_MS = 620;
const PANEL_OPEN_MS = 1_850;

interface HandoffRecord extends SceneTransitionCopy {
  target: string;
  issuedAt: number;
}

interface SceneTransitionContextValue {
  phase: SceneTransitionPhase;
  isTransitioning: boolean;
  navigate: (target: string, options?: SceneNavigationOptions) => boolean;
}

const SceneTransitionContext = createContext<SceneTransitionContextValue | null>(null);

function locationKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

function readIncomingHandoff(): HandoffRecord | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<HandoffRecord>;
    const current = locationKey(new URL(window.location.href));
    const valid =
      typeof record.target === "string" &&
      typeof record.issuedAt === "number" &&
      Date.now() - record.issuedAt < HANDOFF_TTL_MS &&
      record.target === current;

    if (!valid) {
      window.sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }

    return record as HandoffRecord;
  } catch {
    window.sessionStorage.removeItem(HANDOFF_KEY);
    return null;
  }
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

async function waitForDocumentImages() {
  const images = Array.from(document.images);
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      if (typeof image.decode === "function") await image.decode().catch(() => undefined);
    })
  );
}

async function defaultSceneReady() {
  await nextPaint();
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  await Promise.all([waitForWindowLoad(), fontsReady, waitForDocumentImages()]);
}

function delay(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

export interface SceneTransitionProviderProps {
  children: ReactNode;
  /** 业务数据另有 ready 信号时在这里补充；图片与字体仍由共享层自动等待。 */
  ready?: () => Promise<unknown>;
  /** 满屏世界页使用 fade；只占画布一部分的实体面板可使用 panel-drop。 */
  reveal?: SceneRevealMode;
  minimumBlackoutMs?: number;
  maximumReadyWaitMs?: number;
}

export function SceneTransitionProvider({
  children,
  ready,
  reveal = "fade",
  minimumBlackoutMs = 320,
  maximumReadyWaitMs = 6_000
}: SceneTransitionProviderProps) {
  // 必须惰性读取一次。若把 readIncomingHandoff() 直接传给 useRef，它会在
  // 每次 render 都执行；源页面写入“目标页 marker”后，下一次源页 render
  // 会因路径不匹配把 marker 误删，跨文档接力随即失效。
  const [incoming] = useState<HandoffRecord | null>(() => readIncomingHandoff());
  const incomingRef = useRef<HandoffRecord | null>(incoming);
  const [phase, setPhase] = useState<SceneTransitionPhase>(
    incomingRef.current ? "closed" : "idle"
  );
  const [copy, setCopy] = useState<SceneTransitionCopy>(() => incomingRef.current ?? {});
  const phaseRef = useRef(phase);
  const navigationTimerRef = useRef<number | null>(null);

  /*
   * 根节点属性必须在首帧绘制前写入。否则目标文档已经 mount、普通 effect
   * 还没执行的那一帧会闪出完整面板，随后才跳回上方。layout effect 既不把
   * handoff 状态塞进业务 DOM，也能让所有固定画布应用共用同一套入场契约。
   */
  useLayoutEffect(() => {
    phaseRef.current = phase;
    const active = phase !== "idle";
    const root = document.documentElement;
    const isIncoming = incomingRef.current !== null;

    if (active) root.setAttribute("data-scene-transition", phase);
    else root.removeAttribute("data-scene-transition");

    if (isIncoming) {
      root.setAttribute("data-scene-incoming", "");
      root.setAttribute("data-scene-reveal", reveal);
    } else {
      root.removeAttribute("data-scene-incoming");
      root.removeAttribute("data-scene-reveal");
    }

    if (active) document.body.setAttribute("aria-busy", "true");
    else document.body.removeAttribute("aria-busy");

    return () => {
      root.removeAttribute("data-scene-transition");
      root.removeAttribute("data-scene-incoming");
      root.removeAttribute("data-scene-reveal");
      document.body.removeAttribute("aria-busy");
    };
  }, [phase, reveal]);

  useEffect(() => {
    const incoming = incomingRef.current;
    if (!incoming) return;

    let cancelled = false;
    let openTimer: number | null = null;
    const startedAt = performance.now();

    void (async () => {
      const visualReady = defaultSceneReady();
      const appReady = ready ? ready() : Promise.resolve();
      await Promise.race([
        Promise.allSettled([visualReady, appReady]),
        delay(maximumReadyWaitMs)
      ]);

      const elapsed = performance.now() - startedAt;
      if (elapsed < minimumBlackoutMs) await delay(minimumBlackoutMs - elapsed);
      if (cancelled) return;

      setPhase("opening");
      const openingDuration = reveal === "panel-drop" ? PANEL_OPEN_MS : FADE_OPEN_MS;
      openTimer = window.setTimeout(() => {
        if (cancelled) return;
        setPhase("idle");
        window.sessionStorage.removeItem(HANDOFF_KEY);
        incomingRef.current = null;
      }, openingDuration);
    })();

    return () => {
      cancelled = true;
      if (openTimer !== null) window.clearTimeout(openTimer);
    };
  }, [maximumReadyWaitMs, minimumBlackoutMs, ready, reveal]);

  useEffect(
    () => () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    },
    []
  );

  const navigate = useCallback((target: string, options: SceneNavigationOptions = {}) => {
    if (phaseRef.current !== "idle") return false;

    const targetUrl = new URL(target, window.location.href);
    const nextCopy = {
      destination: options.destination,
      channel: options.channel
    };
    phaseRef.current = "closing";
    setCopy(nextCopy);
    setPhase("closing");

    navigationTimerRef.current = window.setTimeout(() => {
      phaseRef.current = "closed";
      setPhase("closed");

      if (targetUrl.origin === window.location.origin) {
        const handoff: HandoffRecord = {
          ...nextCopy,
          target: locationKey(targetUrl),
          issuedAt: Date.now()
        };
        window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
      }

      // 闭合态至少绘制一帧再卸载旧文档，避免慢设备在最后一刻露出旧场景。
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (options.replace) window.location.replace(targetUrl.href);
          else window.location.assign(targetUrl.href);
        });
      });
    }, CLOSE_MS);

    return true;
  }, []);

  const value = useMemo<SceneTransitionContextValue>(
    () => ({ phase, isTransitioning: phase !== "idle", navigate }),
    [navigate, phase]
  );

  return (
    <SceneTransitionContext.Provider value={value}>
      {children}
      <SceneTransition phase={phase} {...copy} />
    </SceneTransitionContext.Provider>
  );
}

export function useSceneTransition() {
  const value = useContext(SceneTransitionContext);
  if (!value) {
    throw new Error("useSceneTransition must be used inside SceneTransitionProvider");
  }
  return value;
}
