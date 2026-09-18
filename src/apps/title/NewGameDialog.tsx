import type { GameStartPoint } from "../../game-runtime/player-runtime";
import { RpgModal } from "../../shared/ui/primitives/RpgModal";

const starts: {id: GameStartPoint; label: string; description: string}[] = [
  {id: "prologue", label: "完整开始", description: "从开场序章开始，依次体验剧情与战斗教程。"},
  {id: "first-morning", label: "跳过序章", description: "从第一章「洋馆的第一个清晨」开始。"},
  {id: "tutorial", label: "跳过第一章（抵达教程）", description: "略过前面的剧情，先查看玩法总览，再开始战斗与事件教学。"},
  {id: "hub", label: "跳过教程", description: "略过序章、第一章与教程，直接进入自由枢纽。不领取教程奖励。"},
];

export function NewGameDialog({open, busy, message, onClose, onStart, onPresentChange}: {
  open: boolean; busy: boolean; message: string; onClose: () => void; onStart: (startAt: GameStartPoint) => void;
  onPresentChange?: (present: boolean) => void;
}) {
  return <RpgModal open={open} title="选择旅程起点" panelClassName="title-start"
    onPresentChange={onPresentChange}
    onClose={onClose} closable={!busy} dismissOnBackdrop={!busy} dismissOnEscape={!busy}>
    <p className="title-start__intro">第一次来到这里？建议完整开始。也可以直接前往想体验的章节。</p>
    <div className="title-start__options" aria-busy={busy}>
      {starts.map((start, i) => <button key={start.id} type="button" className="title-start__option"
        data-primary={i === 0 || undefined} aria-label={start.label} aria-describedby={`start-${start.id}`}
        disabled={busy} onClick={event => {
          // The opening double-click's second click can land on this new panel.
          // It is not a deliberate chapter choice; keyboard activation is detail 0.
          if (event.detail <= 1) onStart(start.id);
        }}>
        <span className="title-start__index" aria-hidden="true">0{i + 1}</span>
        <span className="title-start__copy"><strong>{start.label}</strong><span id={`start-${start.id}`}>{start.description}</span></span>
        <span className="title-start__arrow" aria-hidden="true">›</span>
      </button>)}
    </div>
    <p className="title-start__note">仅建立新档，不覆盖已有进度。选择后开始，关闭可返回标题。</p>
    <p className="title-start__status" role="status">{message}</p>
  </RpgModal>;
}
