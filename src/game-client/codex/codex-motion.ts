import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, cubicBezier, useMotionValue } from "motion/react";
import { motionTokens } from "../../shared/ui/motion/presets";
import type { SystemSceneMotion } from "../system-panel-motion";

const timing = motionTokens.codexPanel;
const appear = cubicBezier(.2, .6, .3, 1);
const disappear = cubicBezier(.45, 0, .55, 1);
const clear = cubicBezier(.4, 0, 1, 1);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Part = "structure" | "index" | "stage" | "art" | "title" | "description" | "facts" | "record" | "drops" | "footer";
type Frame = { alpha: number; blur: number; scale: number };
type Frames = Record<Part, Frame>;
type Cue = { enter: [number, number]; exit: [number, number]; blur?: number; focusMs?: number };
const cues: Record<Part, Cue> = {
  structure: { enter: [0, 320], exit: [220, 400] },
  index: { enter: [80, 400], exit: [0, 360] },
  stage: { enter: [120, 680], exit: [180, 420], blur: 1.2, focusMs: 500 },
  art: { enter: [180, 820], exit: [140, 420], blur: 1.5, focusMs: 580 },
  title: { enter: [200, 400], exit: [0, 360], blur: .8, focusMs: 260 },
  description: { enter: [260, 420], exit: [0, 360] },
  facts: { enter: [320, 440], exit: [0, 360] },
  record: { enter: [380, 440], exit: [0, 360] },
  drops: { enter: [380, 440], exit: [0, 360] },
  footer: { enter: [380, 440], exit: [0, 360] },
};
const parts = Object.keys(cues) as Part[];
const entryCues: Partial<Record<Part, [number, number]>> = {
  art: [0, 500], title: [30, 300], description: [80, 320], facts: [130, 320], record: [180, 320], drops: [180, 320],
};
const entryParts = Object.keys(entryCues) as Part[];
const spread = (part: Part) => part === "art" ? 1.025 : part === "stage" ? 1.065 : 1;
const frames = (alpha = 1): Frames => Object.fromEntries(parts.map(part => [part, { alpha, blur: alpha ? 0 : cues[part].blur ?? 0, scale: alpha ? 1 : spread(part) }])) as Frames;
const copy = (value: Frames): Frames => Object.fromEntries(parts.map(part => [part, { ...value[part] }])) as Frames;

/** Timings are local to the direction; the host still owns the clock/unmount.
 * A reversal interpolates from the painted values, never from a fresh endpoint. */
export function codexSceneFrame(origin: Frames, progress: number, exiting: boolean): Frames {
  const ms = progress * (exiting ? timing.exitMs : timing.enterMs);
  return Object.fromEntries(parts.map(part => {
    const cue = cues[part], [start, duration] = exiting ? cue.exit : cue.enter;
    const amount = (exiting ? disappear : appear)(clamp((ms - start) / duration));
    const focus = appear(clamp((ms - start) / (cue.focusMs ?? duration)));
    return [part, {
      alpha: origin[part].alpha + ((exiting ? 0 : 1) - origin[part].alpha) * amount,
      blur: exiting ? origin[part].blur + ((part === "art" ? 2 : cue.blur ?? 0) - origin[part].blur) * amount : origin[part].blur * (1 - focus),
      scale: origin[part].scale + ((exiting ? spread(part) : 1) - origin[part].scale) * (exiting ? amount : focus),
    }];
  })) as Frames;
}

const imageCache = new Map<string, { ready: boolean; promise: Promise<void> }>();
function prepareImage(src: string) {
  let cached = imageCache.get(src);
  if (!cached) {
    const image = new Image();
    image.src = src;
    cached = { ready: false, promise: image.decode().catch(() => {}).then(() => { cached!.ready = true; }) };
    imageCache.set(src, cached);
  }
  return cached;
}

export function useCodexMotion(root: RefObject<HTMLElement | null>, scene: SystemSceneMotion,
  initialId: string | undefined, images: readonly string[]) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [content, setContent] = useState({ id: initialId, revision: 0 });
  const displayed = useRef(initialId), requested = useRef(initialId);
  const sceneFrames = useRef(frames(scene.clock.get() === 1 ? 1 : 0));
  const entryFrames = useRef(frames());
  const entryPhase = useRef<"ready" | "out" | "commit" | "in">("ready");
  const sceneState = useRef(scene); sceneState.current = scene;
  const entryClock = useMotionValue(0), imageClock = useMotionValue(1);
  const entryControl = useRef<{ stop(): void } | null>(null);
  const entrySubscription = useRef<(() => void) | null>(null);
  const generation = useRef(0);

  const paint = () => {
    const panel = root.current;
    if (!panel) return;
    for (const part of parts) {
      const alpha = sceneFrames.current[part].alpha * entryFrames.current[part].alpha * (part === "art" ? imageClock.get() : 1);
      const blur = Math.max(sceneFrames.current[part].blur, entryFrames.current[part].blur);
      panel.style.setProperty(`--codex-${part}`, String(alpha));
      if (part === "art" || part === "title") panel.style.setProperty(`--codex-${part}-filter`, blur < .001 || alpha === 0 ? "none" : `blur(${blur}px)`);
      if (part === "art" || part === "stage") panel.style.setProperty(`--codex-${part}-scale`, String(Math.max(sceneFrames.current[part].scale, entryFrames.current[part].scale)));
    }
    panel.style.setProperty("--codex-stage-blur", `${sceneFrames.current.stage.blur}px`);
    panel.dataset.codexEntryPhase = entryPhase.current;
  };
  const stopEntry = () => {
    generation.current++;
    entryControl.current?.stop();
    entrySubscription.current?.();
    entryControl.current = null; entrySubscription.current = null;
  };
  const runEntry = (exiting: boolean) => {
    stopEntry();
    entryPhase.current = exiting ? "out" : "in";
    const origin = copy(entryFrames.current), token = generation.current;
    entryClock.set(0);
    const update = (progress: number) => {
      for (const part of entryParts) {
        const [start, duration] = entryCues[part]!;
        const value = exiting ? clear(progress) : appear(clamp((progress * timing.changeInMs - start) / duration));
        const focus = appear(clamp((progress * timing.changeInMs - start) / (part === "art" ? 350 : duration)));
        entryFrames.current[part] = {
          alpha: origin[part].alpha + ((exiting ? 0 : 1) - origin[part].alpha) * value,
          blur: exiting ? origin[part].blur + ((part === "art" ? 2.2 : 0) - origin[part].blur) * value : origin[part].blur * (1 - focus),
          scale: origin[part].scale + ((exiting ? spread(part) : 1) - origin[part].scale) * (exiting ? value : focus),
        };
      }
      paint();
    };
    update(0);
    entrySubscription.current = entryClock.on("change", update);
    const duration = exiting ? timing.changeOutMs * Math.max(.45, ...entryParts.map(part => origin[part].alpha)) : timing.changeInMs;
    const control = animate(entryClock, 1, { duration: duration / 1000, ease: "linear" });
    entryControl.current = control;
    void control.then(() => {
      if (token !== generation.current) return;
      update(1);
      entrySubscription.current?.(); entrySubscription.current = null;
      entryControl.current = null;
      if (exiting) {
        entryPhase.current = "commit";
        // React commits all fields while their opacity is zero. No old/new pairs.
        displayed.current = requested.current;
        setContent(previous => ({ id: requested.current, revision: previous.revision + 1 }));
      } else entryPhase.current = "ready";
      paint();
    });
  };

  useLayoutEffect(() => {
    if (scene.skip) {
      sceneFrames.current = frames(); paint();
      if (root.current) root.current.dataset.codexScenePhase = "ready";
      return;
    }
    const origin = copy(sceneFrames.current), start = scene.clock.get(), goal = scene.exiting ? 0 : 1;
    const update = (value: number) => {
      const progress = start === goal ? 1 : clamp((value - start) / (goal - start));
      sceneFrames.current = codexSceneFrame(origin, progress, scene.exiting);
      if (root.current) root.current.dataset.codexScenePhase = progress === 1 ? scene.exiting ? "hidden" : "ready" : scene.exiting ? "out" : "in";
      paint();
    };
    update(start);
    return scene.clock.on("change", update);
  }, [scene.clock, scene.exiting, scene.skip]);

  useLayoutEffect(() => {
    if (scene.skip) {
      stopEntry(); entryFrames.current = frames(); entryPhase.current = "ready";
      if (displayed.current !== requested.current) {
        displayed.current = requested.current;
        setContent(previous => ({ id: requested.current, revision: previous.revision + 1 }));
      }
      paint();
    } else if (scene.exiting) {
      stopEntry(); requested.current = displayed.current; setSelectedId(displayed.current);
    } else if (entryPhase.current !== "ready") runEntry(requested.current !== displayed.current);
  }, [scene.skip, scene.exiting]);

  useLayoutEffect(() => {
    if (!content.revision) return;
    const details = root.current?.querySelector<HTMLElement>(".codex-details");
    if (details) details.scrollTop = 0;
    if (sceneState.current.skip) return;
    // This runs after the new content's DOM and final layout have committed.
    if (entryPhase.current === "commit" && !sceneState.current.exiting) {
      entryFrames.current.art.blur = 2.2;
      entryFrames.current.title.blur = .8;
      runEntry(false);
    }
  }, [content]);

  useEffect(() => {
    if (!scene.skip) images.forEach(prepareImage);
  }, [images, scene.skip]);
  useLayoutEffect(() => imageClock.on("change", paint), [imageClock]);
  useEffect(() => () => stopEntry(), []);

  const select = (id: string) => {
    if (sceneState.current.exiting || id === requested.current) return;
    requested.current = id; setSelectedId(id);
    if (sceneState.current.skip) {
      stopEntry(); entryFrames.current = frames(); entryPhase.current = "ready";
      displayed.current = id; setContent(previous => ({ id, revision: previous.revision + 1 })); paint();
    } else if (entryPhase.current !== "out") runEntry(true);
  };

  return { selectedId, displayedId: content.id, select, imageClock };
}

/** Cached images join the entry timeline; a cold image gets its own soft reveal. */
export function useCodexImage(src: string | undefined, skip: boolean, exiting: boolean,
  clock: ReturnType<typeof useMotionValue<number>>) {
  const previousSrc = useRef(src);
  useLayoutEffect(() => {
    if (!src || skip) { clock.set(1); return; }
    if (exiting) return;
    const changed = previousSrc.current !== src;
    previousSrc.current = src;
    const cached = prepareImage(src);
    if (cached.ready) {
      if (changed || clock.get() === 1) { clock.set(1); return; }
      const control = animate(clock, 1, { duration: timing.changeInMs / 1000, ease: appear });
      return () => control.stop();
    }
    clock.set(0);
    let active = true, control: { stop(): void } | undefined;
    void cached.promise.then(() => {
      if (active) control = animate(clock, 1, { duration: timing.changeInMs / 1000, ease: appear });
    });
    return () => { active = false; control?.stop(); };
  }, [src, skip, exiting, clock]);
}

/** Quarter turns preserve the dial's four cardinal ornaments at rest.
 * Rapid requests retarget the current turn instead of queuing revolutions. */
export function useCodexDial(root: RefObject<HTMLElement | null>, selectedId: string | undefined,
  ids: readonly string[], scene: SystemSceneMotion) {
  const clock = useMotionValue(0);
  const state = useRef({ angle: !scene.skip && scene.clock.get() < 1 ? -90 : 0, scale: 1, blur: 0, presence: 1 });
  const previousId = useRef(selectedId), target = useRef(0);
  const control = useRef<{ stop(): void } | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const paint = () => {
    const panel = root.current;
    if (!panel) return;
    panel.style.setProperty("--codex-dial-angle", `${state.current.angle}deg`);
    panel.style.setProperty("--codex-dial-scale", String(state.current.scale));
    panel.style.setProperty("--codex-dial-blur", `${state.current.blur}px`);
    panel.style.setProperty("--codex-dial-presence", String(state.current.presence));
  };
  const stop = () => {
    control.current?.stop(); control.current = null;
    unsubscribe.current?.(); unsubscribe.current = null;
  };
  const turn = () => {
    stop();
    const origin = { ...state.current }, destination = target.current;
    clock.set(0);
    if (root.current) root.current.dataset.codexDialPhase = "turning";
    const update = (progress: number) => {
      const ms = progress * timing.dialTurnMs;
      const expansion = appear(clamp(ms / timing.changeOutMs));
      const focus = appear(clamp((ms - timing.changeOutMs) / timing.changeInMs));
      const turn = appear(clamp((ms - 45) / (timing.dialTurnMs - 45)));
      state.current = {
        angle: origin.angle + (destination - origin.angle) * turn,
        scale: ms < timing.changeOutMs ? origin.scale + (1.065 - origin.scale) * expansion : 1.065 - .065 * focus,
        blur: ms < timing.changeOutMs ? origin.blur + (1.2 - origin.blur) * expansion : 1.2 * (1 - focus),
        presence: ms < timing.changeOutMs ? origin.presence + (.62 - origin.presence) * expansion : .62 + .38 * focus,
      };
      if (progress === 1) state.current = { angle: destination, scale: 1, blur: 0, presence: 1 };
      paint();
    };
    update(0);
    unsubscribe.current = clock.on("change", update);
    const flight = animate(clock, 1, { duration: timing.dialTurnMs / 1000, ease: "linear" });
    control.current = flight;
    void flight.then(() => {
      if (control.current !== flight) return;
      update(1); stop();
      if (root.current) root.current.dataset.codexDialPhase = "ready";
    });
  };
  useLayoutEffect(() => {
    const lastId = previousId.current;
    previousId.current = selectedId;
    if (scene.exiting) { stop(); return; }
    if (scene.skip) {
      stop(); state.current = { angle: target.current, scale: 1, blur: 0, presence: 1 }; paint();
      if (root.current) root.current.dataset.codexDialPhase = "ready";
      return;
    }
    if (lastId !== selectedId) {
      const direction = ids.indexOf(selectedId!) > ids.indexOf(lastId!) ? 1 : -1;
      const next = (direction > 0 ? Math.floor(state.current.angle / 90 + .00001) + 1 : Math.ceil(state.current.angle / 90 - .00001) - 1) * 90;
      if (next !== target.current || !control.current) { target.current = next; turn(); }
    } else if (!control.current && (state.current.angle !== target.current || state.current.scale !== 1)) turn();
    else if (!control.current) { paint(); if (root.current) root.current.dataset.codexDialPhase = "ready"; }
  }, [selectedId, ids, scene.exiting, scene.skip, clock]);
  useEffect(() => stop, []);
}
