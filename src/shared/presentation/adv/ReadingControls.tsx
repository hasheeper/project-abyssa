import type { ReactNode } from "react";
import { ReadingTool, ReadingToolsDisabled } from "./ReadingTool";
import { DiamondWatermark } from "../../ui/primitives/DiamondWatermark";
import type { ReadingLayout } from "./useReadingPresentation";
import replayIcon from "../../../assets/icons/anticlockwise-rotation.svg";
import bookIcon from "../../../assets/icons/items/open-book.svg";
import playIcon from "../../../assets/icons/play-button.svg";
import forwardIcon from "../../../assets/icons/fast-forward-button.svg";
import "./reading-controls.css";

export function readingRoman(n: number): string {
  let value = Math.max(1, Math.floor(n)), result = "";
  for (const [size, glyph] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] as const)
    while (value >= size) {result += glyph; value -= size;}
  return result;
}
function Chevron({flip = false}: {flip?: boolean}) {
  return <svg viewBox="0 0 12 12" aria-hidden="true" style={flip ? {transform:"scaleX(-1)"} : undefined}><path d="M4.125 2.25 L7.875 6 L4.125 9.75" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>;
}
function Caret({side}: {side: "start" | "end"}) {
  return <svg className="rp-app__cue-caret" data-side={side} viewBox="0 0 12 12" aria-hidden="true"><path d={side === "start" ? "M4 3 L9 6 L4 9 Z" : "M8 3 L3 6 L8 9 Z"} fill="currentColor"/></svg>;
}

export type ReadingControlsProps = {
  layout: ReadingLayout; reading: boolean; reviewing: boolean; auto: boolean; skipping: boolean;
  disabled?: boolean; layoutDisabled?: boolean; canReplay: boolean; canPlay: boolean; canSkip: boolean;
  sceneIndex: number; sceneTotal: number; location: string; label: string; nextDisabled?: boolean;
  onLayout: () => void; onLog: () => void; onReplay: () => void; onAuto: () => void; onSkip: () => void;
  onScene: (index: number) => void; onNext: () => void; actions?: ReactNode;
};
/** The sole full-page reading rail. Business actions append, never replace base tools. */
export function ReadingControls(p: ReadingControlsProps) {
  return <ReadingToolsDisabled.Provider value={!!p.disabled}><footer className="rp-app__bar">
    <DiamondWatermark className="rp-app__bar-watermark" size={48} innerInset={10} patternTransform="translate(0 2)"
      outerFill="currentColor" innerFill="currentColor" outerOpacity={0.09} innerOpacity={0.016}/>
    <nav className="rp-app__pager" aria-label="幕切换" title={p.location}>
      <button type="button" className="rp-app__chip rp-app__chip--nav" aria-label="上一幕" disabled={p.disabled || p.sceneIndex <= 0} onClick={() => p.onScene(p.sceneIndex - 1)}><Chevron flip/></button>
      <span className="rp-app__cell rp-app__scene" data-live={!p.reviewing || undefined}>
        <span className="rp-app__cell-main rp-app__scene-no">{readingRoman(p.sceneIndex + 1)}<em>/</em>{readingRoman(p.sceneTotal)}</span>
        <span className="rp-app__cell-label">{p.reviewing ? "REPLAY" : "SCENE"}</span>
      </span>
      <button type="button" className="rp-app__chip rp-app__chip--nav" aria-label="下一幕" disabled={p.disabled || p.sceneIndex >= p.sceneTotal - 1} onClick={() => p.onScene(p.sceneIndex + 1)}><Chevron/></button>
    </nav>
    <button type="button" className="rp-app__cell rp-app__cue" aria-label={p.label} disabled={p.disabled || p.nextDisabled} onClick={p.onNext}>
      <span className="rp-app__cue-line"><Caret side="start"/><span className="rp-app__cue-word">{Array.from(p.label).map((char,i)=><span key={i}>{char}</span>)}</span><Caret side="end"/></span>
    </button>
    <nav className="rp-app__tools" aria-label="演出控制">
      <ReadingTool label={p.layout === "adv" ? "切换为 NVL 舞台" : "切换为 AVG 舞台"} caption={p.layout === "adv" ? "NVL" : "AVG"} glyph={p.layout === "adv" ? "nvl" : "adv"} disabled={p.disabled || p.layoutDisabled} onClick={p.onLayout}/>
      <ReadingTool label={p.reviewing ? "返回当前进度" : "从头重播"} caption="REPLAY" icon={replayIcon} shrink pressed={p.reviewing} disabled={p.disabled || !p.canReplay} onClick={p.onReplay}/>
      <ReadingTool label={p.reading ? "关闭回看" : "回看已读对白"} caption="LOG" icon={bookIcon} pressed={p.reading} disabled={p.disabled} onClick={p.onLog}/>
      <ReadingTool label={p.auto ? "停止自动播放" : "自动播放"} caption="AUTO" icon={playIcon} pressed={p.auto} disabled={p.disabled || !p.canPlay && !p.auto} onClick={p.onAuto}/>
      <ReadingTool label={p.skipping ? "停止快进" : "跳过本段对白"} caption="SKIP" icon={forwardIcon} pressed={p.skipping} disabled={p.disabled || !p.canSkip && !p.skipping} onClick={p.onSkip}/>
      {p.actions}
    </nav>
  </footer></ReadingToolsDisabled.Provider>;
}
