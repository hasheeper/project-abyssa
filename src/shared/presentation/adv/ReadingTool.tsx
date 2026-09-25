import { createContext, useContext } from "react";
import { useSceneSequenceBusy } from "./SceneSequence";

export const ReadingToolsDisabled = createContext(false);

type Props = { label: string; caption: string; disabled?: boolean; pressed?: boolean; shrink?: boolean; onClick: () => void } & ({ icon: string; glyph?: never } | { glyph: "back" | "close" | "adv" | "nvl"; icon?: never });

/** Established ADV icon/caption cell; never mount modal-sized controls in the 52px reading rail. */
export function ReadingTool({ label, caption, icon, glyph, disabled = false, pressed, shrink, onClick }: Props) {
  const entering = useSceneSequenceBusy();
  const railBusy = useContext(ReadingToolsDisabled);
  return <button type="button" className="rp-app__cell rp-app__tool" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled || entering || railBusy} onClick={onClick}>
    {glyph ? <i className="rp-app__cell-main rp-app__tool-icon" data-glyph={glyph} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{glyph === "close" ? <path d="m6 6 12 12M18 6 6 18"/>
        : glyph === "back" ? <path d="m9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6v2" strokeWidth="2.2" strokeLinejoin="miter"/>
        : <><rect x="3" y="5" width="18" height="14" strokeWidth="2.2"/>{glyph === "nvl" ? <><path d="M8.8 5V19M15.2 5V19"/><path d="M10.6 9.15h2.8m-2.8 3h2.8m-2.8 3h1.8" strokeWidth="1.5"/></> : <><rect x="5.8" y="13.8" width="12.4" height="3.6" fill="currentColor" stroke="none"/><path d="M8 8.75h4.4M8 11.35h2.8" strokeWidth="1.5"/></>}</>}</svg>
    </i> : <i className="rp-app__cell-main rp-app__tool-icon" data-shrink={shrink || undefined} aria-hidden="true" style={{ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")` }}/>}
    <span className="rp-app__cell-label" aria-hidden="true">{caption}</span>
  </button>;
}
