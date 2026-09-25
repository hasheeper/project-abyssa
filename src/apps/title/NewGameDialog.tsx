import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, usePresence } from "motion/react";
import type { GameStartPoint } from "../../game-runtime/player-runtime";
import { playerNameProblem, PLAYER_NAME_MAX_LENGTH } from "../../game-runtime/player-name";
import { LoadingPlaque } from "../../shared/transition/LoadingPlaque";
import { RpgShapeButton } from "../../shared/ui/primitives/RpgShapeButton";
import { modalFocusables, useModalPresentation } from "../../shared/ui/primitives/useModalPresentation";
import { UiContentTransition } from "../../shared/ui/motion/UiContentTransition";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { uiTransition } from "../../shared/ui/motion/presets";
import "./new-game-opening.css";

export const NEW_GAME_STARTS: {id: GameStartPoint; label: string; description: string}[] = [
  {id: "prologue", label: "序章", description: "完整剧情与教学。"},
  {id: "first-morning", label: "洋馆的清晨", description: "略过序章，从洋馆的第一个清晨开始。"},
  {id: "tutorial", label: "战斗与探索教学", description: "从岩窟篇的实战教学开始。"},
  {id: "hub", label: "自由行动", description: "跳过教程，带上教程奖励开始自由行动。"},
  {id: "airp-director", label: "AIRP 游玩", description: "日度事件与副本叙事，接入普通副本和正式掉落。需自备模型连接；剧情暂用工作稿。"},
];
const DEBUG_STARTS = [
  {id: "debug-shop", label: "商店初见调试", description: "跳过开场与教程，获得教程奖励，保留首次 SHOP 演出。"},
  {id: "airp-demo", label: "旧版 AIRP 调试", description: "旧版药箱流程，仅供兼容复验。"},
] as const;
export type NewGameSelection = {playerName: string; startAt: GameStartPoint};
type Props = {
  open: boolean; busy: boolean; message: string; onClose: () => void;
  onStart: (selection: NewGameSelection) => void;
  pending?: NewGameSelection | null;
  onPresentChange?: (present: boolean) => void;
};
type Step = "name" | "start" | "confirm";

/** An explicit setup screen, not a conversation with an unseen narrator. */
export function NewGameDialog(props: Props) {
  return <AnimatePresence>{props.open && <Opening key="new-game" {...props}/>}</AnimatePresence>;
}
function Opening({busy, message, onClose, onStart, pending, onPresentChange}: Props) {
  const [present, remove] = usePresence(), {reduced} = useUiMotion();
  const veil = useMotionValue(0), ink = useMotionValue(0);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(pending ? "confirm" : "name");
  const [name, setName] = useState(pending?.playerName ?? "");
  const [startAt, setStartAt] = useState<GameStartPoint>(pending?.startAt ?? "prologue");
  const [debugOpen, setDebugOpen] = useState(DEBUG_STARTS.some(start => start.id === pending?.startAt));
  const [attempted, setAttempted] = useState(!!pending), [invalid, setInvalid] = useState(false);
  const root = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const composing = useRef(false), submitting = useRef(false);
  useModalPresentation(panel, root, present, undefined, onPresentChange);
  const normalizedName = name.trim().normalize("NFC");
  const problem = playerNameProblem(normalizedName);
  const normalStart = NEW_GAME_STARTS.find(start => start.id === startAt);
  const selected = normalStart ?? DEBUG_STARTS.find(start => start.id === startAt)!;
  const locked = !present || !ready || busy;
  const backLabel = attempted || step === "name" ? "返回标题" : "上一步";
  const advanceLabel = step === "confirm" ? busy ? "正在建立" : attempted ? "重试创建" : "开始游戏" : "下一步";

  useLayoutEffect(() => {
    let active = true;
    const controls: {stop: () => void}[] = [];
    const fade = (value: typeof veil, to: number, ms: number, delay = 0) => {
      const control = animate(value, to, {...uiTransition(reduced ? 80 : ms), delay: reduced ? 0 : delay});
      controls.push(control); return control;
    };
    async function run() {
      if (present) {
        await fade(veil, 1, 480);
        if (!active) return;
        await fade(ink, 1, 360, .1);
        if (active) setReady(true);
      } else {
        setReady(false);
        await fade(ink, 0, 140);
        if (!active) return;
        await fade(veil, 0, 280);
        if (active) remove?.();
      }
    }
    void run();
    return () => {active = false; controls.forEach(control => control.stop());};
  }, [present, reduced, veil, ink, remove]);

  useLayoutEffect(() => {
    if (!ready || !present || busy) return;
    const target = step === "name" ? panel.current?.querySelector<HTMLInputElement>("input")
      : step === "start" ? panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], .new-game-opening__debug summary')
      : panel.current?.querySelector<HTMLButtonElement>("[data-confirm]");
    target?.focus({preventScroll: true});
  }, [step, ready, present, busy]);

  function back() {
    if (busy || !present) return;
    if (attempted || step === "name") onClose();
    else {
      setStep(step === "confirm" ? "start" : "name");
    }
  }
  function advance() {
    if (locked || composing.current || submitting.current) return;
    if (step === "name") {
      if (problem) {setInvalid(true); return;}
      setName(normalizedName); setInvalid(false); setStep("start");
    } else if (step === "start") setStep("confirm");
    else {submitting.current = true; setAttempted(true); onStart({playerName: normalizedName, startAt});}
  }
  useLayoutEffect(() => {if (!busy) submitting.current = false;}, [busy, message]);
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Enter" && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229 || event.repeat)) {event.preventDefault(); return;}
    if (event.key === "Escape") {event.preventDefault(); back(); return;}
    if (event.key !== "Tab") return;
    const nodes = panel.current ? modalFocusables(panel.current) : [];
    const first = nodes[0], last = nodes.at(-1), active = document.activeElement;
    if (!first) {event.preventDefault(); panel.current?.focus({preventScroll: true});}
    else if (event.shiftKey && (active === first || active === panel.current)) {event.preventDefault(); last?.focus({preventScroll: true});}
    else if (!event.shiftKey && active === last) {event.preventDefault(); first.focus({preventScroll: true});}
  }
  return <div ref={root} className="new-game-opening scene-loading-surface" data-ui-modal-present="" data-open={present}
    data-ready={ready || undefined} data-step={step} data-ui-motion={reduced ? "reduced" : "full"}
    onClickCapture={event => {if (event.detail > 1) {event.preventDefault(); event.stopPropagation();}}}>
    <motion.div className="new-game-opening__black" aria-hidden="true" style={{opacity: veil}}/>
    <motion.div ref={panel} className="new-game-opening__panel" role="dialog" aria-modal="true" aria-label="新的开始"
      tabIndex={-1} aria-busy={busy} onKeyDown={keyDown} style={{opacity: ink}}>
      <div inert={locked}>
        <LoadingPlaque className="new-game-opening__frame">
          <form onSubmit={event => {event.preventDefault(); advance();}} autoComplete="off">
            <h2 className="new-game-opening__heading scene-loading-title">{step === "name" ? "角色姓名" : step === "start" ? "开始位置" : "确认开始"}</h2>
            <motion.div className="new-game-opening__body" initial={false}
              animate={{height: step === "name" ? 78 : step === "start" ? debugOpen ? 384 : 306 : 132}}
              transition={uiTransition(reduced ? 0 : 220)}>
            <UiContentTransition contentKey={step} className="new-game-opening__content">
              {step === "name" ? <div className="new-game-opening__naming">
                <input id="new-game-name" name="player-name" value={name} maxLength={48} spellCheck={false} disabled={locked} aria-label="请输入角色姓名"
                  aria-describedby={invalid && problem ? "new-game-name-hint" : undefined} aria-invalid={invalid && !!problem || undefined}
                  onChange={event => {setName(event.target.value); setInvalid(false);}}
                  onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}/>
                {invalid && problem && <p id="new-game-name-hint" className="new-game-opening__hint" role="alert">
                  {problem === "empty" ? "请输入姓名" : problem === "length" ? `最多 ${PLAYER_NAME_MAX_LENGTH} 个字` : "姓名含有不支持的字符"}
                </p>}
              </div> : step === "start" ? <>
                <div className="new-game-opening__starts" role="radiogroup" aria-label="开始位置" aria-describedby="new-game-start-description">
                  {NEW_GAME_STARTS.map((start, index) => <button key={start.id} type="button" role="radio" aria-checked={startAt === start.id} disabled={locked}
                    tabIndex={startAt === start.id || !normalStart && index === 0 ? 0 : -1} onClick={() => setStartAt(start.id)}
                    onKeyDown={event => {
                      const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
                      if (!delta && event.key !== "Home" && event.key !== "End") return;
                      event.preventDefault();
                      const next = event.key === "Home" ? 0 : event.key === "End" ? NEW_GAME_STARTS.length - 1 : (index + delta + NEW_GAME_STARTS.length) % NEW_GAME_STARTS.length;
                      setStartAt(NEW_GAME_STARTS[next].id);
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next].focus({preventScroll: true});
                    }}>
                    <span>{start.label}</span>
                  </button>)}
                </div>
                <p id="new-game-start-description" className="new-game-opening__description">{selected.description}</p>
                <details className="new-game-opening__debug" open={debugOpen} onToggle={event => setDebugOpen(event.currentTarget.open)}>
                  <summary>调试入口</summary>
                  <div className="new-game-opening__debug-starts">
                    {DEBUG_STARTS.map(start => <button key={start.id} type="button" disabled={locked}
                      onClick={() => {setStartAt(start.id); setStep("confirm");}}>{start.label}</button>)}
                  </div>
                </details>
              </> : <>
                <dl className="new-game-opening__summary">
                  <div className="new-game-opening__identity"><dt>角色姓名</dt><dd>{name}</dd></div>
                  <div><dt>开始位置</dt><dd>{selected.label}</dd></div>
                  <div className="new-game-opening__difficulty"><dt>游戏难度</dt><dd title="难度调整暂未开放">标准</dd></div>
                </dl>
              </>}
            </UiContentTransition>
            </motion.div>
            <footer className="new-game-opening__footer">
              <RpgShapeButton shape="chamfer" label={backLabel} onClick={back} disabled={locked}>
                {backLabel}
              </RpgShapeButton>
              <RpgShapeButton shape="chamfer" label={advanceLabel} type="submit" data-confirm="" className="new-game-opening__advance" disabled={locked}>
                {advanceLabel}
              </RpgShapeButton>
            </footer>
          </form>
        </LoadingPlaque>
      </div>
      <p className="new-game-opening__status" role="status">{message}</p>
    </motion.div>
  </div>;
}
