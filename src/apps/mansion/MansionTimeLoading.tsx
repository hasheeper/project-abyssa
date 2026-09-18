import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgFacetDiamond } from "../../shared/ui/primitives/RpgFacetDiamond";
import { LoadingPlaque } from "../../shared/transition/LoadingPlaque";
import type { MansionPhaseId } from "./data";
import { MansionTimeEmblem } from "./MansionTimeEmblem";
import { MansionWeatherGlyph } from "./MansionWeatherGlyph";
import { weatherLabel, type MansionWeather } from "./mansion-weather";
import { MANSION_PASSAGE_TIMING, type MansionPresentation } from "./mansion-presentation-state";
import "./mansion-motion.css";

const phases = ["dawn", "day", "dusk", "night"] as const;
const labels = {dawn: "晨", day: "昼", dusk: "昏", night: "夜"};
const titles = {dawn: "晨光将至", day: "白昼渐明", dusk: "暮色渐沉", night: "夜幕降临"};

export function MansionTimeLoading({phase, fromPhase, day, step, weather, motionPaused, suspended, state, message, error, onRetry, menuHref}: {
  phase: MansionPhaseId;
  fromPhase: MansionPhaseId;
  day: number;
  step: MansionPresentation["step"];
  weather?: MansionWeather;
  motionPaused?: boolean;
  suspended?: boolean;
  state: "loading" | "error";
  message: string;
  error?: string;
  onRetry?: () => void;
  menuHref?: string;
}) {
  const origin = phases.indexOf(fromPhase), destination = phases.indexOf(phase);
  const changing = !weather && fromPhase !== phase;
  // The new artwork/time has been confirmed at paint. Keep this latch through
  // reveal and status updates: the instrument must never restart at handoff.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!motionPaused && !suspended && (step === "paint" || step === "reveal")) setStarted(true);
  }, [step, motionPaused, suspended]);
  // Night → dawn advances through the top of the dial, never spins backwards.
  const end = destination < origin ? destination + phases.length : destination;
  const style = {
    "--time-cover-duration": `${MANSION_PASSAGE_TIMING.cover}ms`,
    "--time-reveal-duration": `${MANSION_PASSAGE_TIMING.reveal}ms`,
    "--time-turn-duration": `${MANSION_PASSAGE_TIMING.settle}ms`,
    "--time-hand-from": `${origin * 90}deg`,
    "--time-hand-to": `${end * 90}deg`
  } as CSSProperties;
  // Viewport-sized like the route curtain, never scaled/clipped by Stage.
  // The portal retains React motion preferences and stays below the route veil.
  const content = <AbyssaProvider className="mansion-time-loading scene-loading-surface" density="compact" data-state={state} data-phase={phase}
    data-time-changing={changing || undefined} data-time-started={started || undefined}
    data-step={step} data-motion-paused={motionPaused || suspended || undefined} hidden={suspended} style={style}
    role={error ? "alert" : "status"} aria-busy={!error} aria-label={weather ? "洋馆天气加载" : "洋馆时段加载"}>
    <div className="mansion-time-loading__content">
      <LoadingPlaque className="mansion-time-loading__plaque">
        <div className="mansion-time-loading__instrument">
          <div className="mansion-time-loading__inscription scene-loading-channel" aria-hidden="true">
            <span>洋馆</span><i/><span>{weather ? "天气" : "时序"}</span>
          </div>
          {weather ? <MansionWeatherGlyph className="mansion-time-loading__weather" weather={weather}/> : <MansionTimeEmblem phase={phase} fromPhase={fromPhase}/>}
          <div className="mansion-time-loading__caption">
            <h1 className="scene-loading-title">{weather ? weatherLabel(weather) : titles[phase]}</h1>
            <p className="mansion-time-loading__day">第 <b>{day}</b> 天<span aria-hidden="true"> · </span>{labels[phase]}时</p>
          </div>
          {!weather && <ol className="mansion-time-loading__phases" aria-label="当日时序">
            {phases.map((p, index) => <li key={p} aria-current={p === phase ? "time" : undefined}
              aria-label={`${labels[p]}时，${p === phase ? "当前时段" : index < destination ? "已过" : "待至"}`}>
              <RpgFacetDiamond label={labels[p]} state={p === phase ? "current" : index < destination ? "elapsed" : "coming"}/>
            </li>)}
          </ol>}
          <p className="mansion-time-loading__message">{error || message}</p>
          {error && <div className="mansion-time-loading__actions">
            {onRetry && <button type="button" className="scene-loading-action" onClick={onRetry}>重试读取</button>}
            {menuHref && <a className="scene-loading-action" href={menuHref}>返回菜单</a>}
          </div>}
        </div>
      </LoadingPlaque>
    </div>
  </AbyssaProvider>;
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
