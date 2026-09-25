import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stage } from "../../stage/Stage";
import { AbyssaProvider } from "../primitives/AbyssaProvider";
import { RpgShapeButton } from "../primitives/RpgShapeButton";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { SceneFeedback, type SceneFeedbackEntry } from "./SceneFeedback";
import manor from "../../../assets/backgrounds/old-manor/welcoming-hall.jpg";
import "../../stage/stage.css";
import "./feedback/preview.css";
import "./confirmation/preview.css";

const samples = {
  overwrite: { title: "覆盖这份档案？", description: "档案 03 · 旧馆的来信\n原有进度将被当前进度替换。", confirmLabel: "确认覆盖", tone: "default" },
  delete: { title: "删除这份档案？", description: "档案 03 · 旧馆的来信\n删除后无法恢复。", confirmLabel: "删除档案", tone: "danger" },
  leave: { title: "返回标题画面？", description: "未保存的进度将会丢失。", confirmLabel: "返回标题", tone: "default" },
  long: { title: "替换旧馆深处尚未完成的旅程？", description: "档案 03 · 留在旧馆深处的那封尚未寄出的信\n当前角色、物品和任务进度将替换这份档案中的记录。请确认你已选择正确的档位；覆盖后，原有记录无法恢复。", confirmLabel: "确认替换", tone: "danger" }
} as const;

function Playground({ initial = "overwrite", reduced = false, narrow = false, inStage = false }: {
  initial?: keyof typeof samples; reduced?: boolean; narrow?: boolean; inStage?: boolean;
}) {
  const [sample, setSample] = useState(initial);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<SceneFeedbackEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFeedback = useRef<SceneFeedbackEntry | null>(null);
  const serial = useRef(0);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const show = (id: keyof typeof samples) => { setSample(id); setFeedback(null); setOpen(true); };
  const scene = <AbyssaProvider motionPreference={reduced ? "reduced" : "system"}
    className="feedback-preview confirmation-preview" data-narrow={narrow || undefined} data-stage={inStage || undefined}
    style={{ backgroundImage: `linear-gradient(180deg, rgb(6 14 15 / 40%), rgb(6 14 15 / 22%) 42%, rgb(6 14 15 / 78%)), url(${manor})` }}>
    <header className="feedback-preview__heading"><div><span>操作确认</span><h1>CONFIRM</h1></div><p>独立样式预览 · 不修改真实档案</p></header>
    <main className="feedback-preview__scene">
      <div className="confirmation-preview__feedback-anchor"><SceneFeedback entry={feedback} edge="right" paused={open} onDismiss={() => setFeedback(null)} /></div>
    </main>
    <footer className="confirmation-preview__controls" aria-label="确认弹窗演示">
      {([['overwrite', '覆盖确认'], ['delete', '删除确认'], ['leave', '返回确认']] as const).map(([id, label]) =>
        <RpgShapeButton key={id} label={label} className="scene-feedback__action" onClick={() => show(id)}><span>{label}</span></RpgShapeButton>)}
      <RpgShapeButton label="侧上提示" className="scene-feedback__action" onClick={() => setFeedback({ id: `notice-${++serial.current}`, kind: "notice", tone: "success", message: "档案已保存" })}><span>侧上提示</span></RpgShapeButton>
      <RpgShapeButton label="事件结果" className="scene-feedback__action" onClick={() => setFeedback({ id: `result-${++serial.current}`, kind: "result", title: "旧馆的来信", label: "委托完成", rewards: [{ id: "money", kind: "currency", currency: "lira", quantity: 120 }] })}><span>事件结果</span></RpgShapeButton>
      <RpgShapeButton label="收起提示" className="scene-feedback__action" onClick={() => setFeedback(null)}><span>收起提示</span></RpgShapeButton>
    </footer>
    <ConfirmationDialog open={open} {...samples[sample]} busy={busy} onCancel={() => setOpen(false)} onPresentChange={present => {
      if (!present && pendingFeedback.current) { setFeedback(pendingFeedback.current); pendingFeedback.current = null; }
    }} onConfirm={() => {
      setBusy(true);
      timer.current = setTimeout(() => {
        setOpen(false); setBusy(false);
        pendingFeedback.current = { id: `confirmed-${++serial.current}`, kind: "notice", tone: "success", message: "确认演示完成，未修改真实档案。" };
      }, 1200);
    }} />
  </AbyssaProvider>;
  return inStage ? <Stage>{scene}</Stage> : scene;
}

const meta = {
  title: "Patterns/Confirmation Dialog", component: Playground,
  parameters: { layout: "fullscreen" }, args: { initial: "overwrite", reduced: false, narrow: false, inStage: false }
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Danger: Story = { args: { initial: "delete" } };
export const Narrow: Story = { args: { narrow: true, initial: "long" } };
export const InStage: Story = { args: { inStage: true } };
export const ReducedMotion: Story = { args: { reduced: true } };
