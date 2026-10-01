import { useId } from "react";
import { motion, useIsPresent } from "motion/react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { surfaceTransition } from "../../shared/ui/motion/presets";
import { RpgShapeButton } from "../../shared/ui/primitives/RpgShapeButton";
import type { DayRange } from "./memory-range";
import "../../shared/ui/styles/scene-feedback.css";
import "./memory-range-editor.css";

/** The range readout opens a local editor; surrounding navigation stays available. */
export function MemoryRangeEditor({ now, fromText, toText, onFromChange, onToChange, onClose, onApply }: {
  now: number; fromText: string; toText: string;
  onFromChange: (value: string) => void; onToChange: (value: string) => void;
  onClose: () => void; onApply: (value: DayRange) => void;
}) {
  const hintId = useId(), present = useIsPresent(), { reduced } = useUiMotion();
  const from = Number(fromText), to = Number(toText);
  const validDays = /^\d+$/.test(fromText) && /^\d+$/.test(toText) && from >= 1 && from <= now && to >= 1 && to <= now;
  const valid = validDays && from <= to;
  const hint = !validDays ? `请输入 1—${now} 之间的天数` : from > to ? "起始日期不能晚于结束日期" : "";
  return <motion.form id="memory-time-editor" className="memory-time__editor scene-feedback__surface" aria-label="精确调整日期"
    inert={!present} aria-hidden={!present || undefined} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={surfaceTransition(reduced, !present)} onSubmit={event => { event.preventDefault(); if (present && valid) onApply({ from, to }); }}>
    <label>从第<input autoFocus type="number" inputMode="numeric" min={1} max={now} step={1} value={fromText}
      onChange={event => onFromChange(event.target.value)} onFocus={event => event.target.select()}
      aria-label="起始天数" aria-describedby={hint ? hintId : undefined} aria-invalid={!valid || undefined}/>天</label>
    <label>至第<input type="number" inputMode="numeric" min={1} max={now} step={1} value={toText}
      onChange={event => onToChange(event.target.value)} onFocus={event => event.target.select()}
      aria-label="结束天数" aria-describedby={hint ? hintId : undefined} aria-invalid={!valid || undefined}/>天</label>
    <RpgShapeButton className="scene-feedback__action memory-time__apply" label="确定" type="submit" disabled={!valid}
      watermark={{ outerOpacity: .2, innerOpacity: .08 }}><span>确定</span></RpgShapeButton>
    <button className="memory-time__cancel" type="button" onClick={onClose}>取消</button>
    {hint && <p id={hintId} className="memory-time__editor-hint" role="status">{hint}</p>}
  </motion.form>;
}
