import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AbyssaProvider } from "../primitives/AbyssaProvider";
import { RpgNotchedPillButton } from "../primitives/RpgNotchedPillButton";
import { SceneFeedback, EventResult, FeedbackNotice, InlineFeedback, type SceneFeedbackEntry } from "./SceneFeedback";
import manor from "../../../assets/backgrounds/old-manor/welcoming-hall.jpg";
import potion from "../../../assets/icons/items/health-potion.svg?url";
import key from "../../../assets/icons/items/skeleton-key.svg?url";
import { previewErrors } from "./feedback/preview-errors";
import "./feedback/preview.css";

const task = {
  kind: "result", title: "旧馆的来信", label: "委托完成",
  rewards: [
    { id: "money", kind: "currency", currency: "lira", quantity: 120 },
    { id: "medicine", kind: "item", name: "回复药", icon: potion, rarity: "silver", quantity: 2 }
  ]
} satisfies Omit<Extract<SceneFeedbackEntry, { kind: "result" }>, "id">;

const item = {
  kind: "result", title: "获得物品",
  rewards: [{ id: "key", kind: "item", name: "铜制钥匙", icon: key, rarity: "bronze", quantity: 1 }]
} satisfies Omit<Extract<SceneFeedbackEntry, { kind: "result" }>, "id">;

const acquisition = {
  kind: "reward", reward: {id: "potion", kind: "item", name: "治疗药水", icon: potion, quantity: 2},
} satisfies Omit<Extract<SceneFeedbackEntry, {kind: "reward"}>, "id">;

function Playground({ reduced = false, edge = "top", stacked = false }: { reduced?: boolean; edge?: "top" | "left" | "right"; stacked?: boolean }) {
  const [entries, setEntries] = useState<SceneFeedbackEntry[]>([{ ...(stacked ? acquisition : task), id: "preview", durationMs: null }]);
  const [error, setError] = useState<"save" | "api" | null>(null);
  const [paused, setPaused] = useState(false);
  const serial = useRef(0);
  const show = (sample: Omit<Extract<SceneFeedbackEntry, { kind: "notice" }>, "id"> | Omit<Extract<SceneFeedbackEntry, { kind: "result" }>, "id"> | typeof acquisition) => {
    const entry = { ...sample, id: `preview-${++serial.current}` };
    setEntries(current => stacked ? [...current, entry] : [entry]);
  };
  return <AbyssaProvider motionPreference={reduced ? "reduced" : "system"} className="feedback-preview" style={{ backgroundImage: `linear-gradient(180deg, rgb(6 14 15 / 66%), rgb(6 14 15 / 34%) 42%, rgb(6 14 15 / 90%)), url(${manor})` }}>
    <header className="feedback-preview__heading">
      <div><span>事件反馈</span><h1>FEEDBACK</h1></div>
      <p>独立组件预览 · 不写入存档</p>
    </header>
    <main className="feedback-preview__scene">
      <div className="feedback-preview__anchor">
        <SceneFeedback {...(stacked ? {entries} : {entry: entries[0] ?? null})} edge={edge} paused={paused}
          onDismiss={id => setEntries(current => current.filter(entry => entry.id !== id))} />
      </div>
    </main>
    <footer className="feedback-preview__controls">
      <div className="feedback-preview__actions" aria-label="触发反馈演示">
        <RpgNotchedPillButton label="完成委托" onClick={() => show(task)} />
        <RpgNotchedPillButton label="获得物品" onClick={() => show(item)} />
        <RpgNotchedPillButton label="获得道具" onClick={() => show(acquisition)} />
        <RpgNotchedPillButton label="操作成功" onClick={() => show({ kind: "notice", tone: "success", message: "档案已保存" })} />
        <RpgNotchedPillButton label="一般提示" onClick={() => show({ kind: "notice", message: "新的记录已加入手记" })} />
        <RpgNotchedPillButton label="条件不足" onClick={() => show({ kind: "notice", tone: "warning", message: "里拉不足，暂时无法购买" })} />
        <RpgNotchedPillButton label="写入报错" selected={error === "save"} onClick={() => setError(value => value === "save" ? null : "save")} />
        <RpgNotchedPillButton label="接口报错" selected={error === "api"} onClick={() => setError(value => value === "api" ? null : "api")} />
      </div>
      <div className="feedback-preview__local">
        {error ? <InlineFeedback {...(error === "api" ? previewErrors.limited : { message: "档案未能写入，请重试。" })} action={{ label: "重试", onClick: () => {
          setError(null); show({ kind: "notice", tone: "success", message: "重试演示完成" });
        } }} /> : <p>点击上方按钮播放；提示自行退场，不打断页面操作。</p>}
      </div>
      <div className="feedback-preview__options">
        <RpgNotchedPillButton label={paused ? "恢复计时" : "暂停计时"} selected={paused} onClick={() => setPaused(value => !value)} />
        <RpgNotchedPillButton label="收起预览" onClick={() => setEntries([])} />
      </div>
    </footer>
  </AbyssaProvider>;
}

function ApiErrorPreview({ narrow = false }: { narrow?: boolean }) {
  const [sample, setSample] = useState<keyof typeof previewErrors>("limited");
  const [retried, setRetried] = useState(false);
  return <AbyssaProvider className="feedback-preview feedback-api-preview" style={{ backgroundImage: `linear-gradient(180deg, rgb(6 14 15 / 66%), rgb(6 14 15 / 62%) 42%, rgb(6 14 15 / 90%)), url(${manor})` }}>
    <header className="feedback-preview__heading"><div><span>服务反馈</span><h1>FEEDBACK</h1></div><p>模拟错误 · 不发起网络请求</p></header>
    <main className="feedback-api-preview__body" data-narrow={narrow || undefined}>
      {retried ? <InlineFeedback tone="info" message="重试演示完成，未发送网络请求。" />
        : <InlineFeedback {...previewErrors[sample]} action={sample === "auth" ? undefined : { label: "重试", onClick: () => setRetried(true) }} />}
    </main>
    <footer className="feedback-preview__controls"><div className="feedback-preview__actions" aria-label="模拟接口错误">
      {([['limited', '请求限流'], ['auth', '认证失败'], ['timeout', '连接超时']] as const).map(([id, label]) =>
        <RpgNotchedPillButton key={id} label={label} selected={sample === id} onClick={() => { setSample(id); setRetried(false); }} />)}
    </div></footer>
  </AbyssaProvider>;
}

function Specimens({ narrow = false }: { narrow?: boolean }) {
  return <AbyssaProvider className="feedback-specimens" style={{ backgroundImage: `linear-gradient(rgb(6 14 15 / 80%), rgb(6 14 15 / 90%)), url(${manor})` }}>
    <header><span>组件样式</span><h1>SCENE FEEDBACK</h1></header>
    <div className="feedback-specimens__grid" data-narrow={narrow || undefined}>
      <section><h2>操作反馈</h2><FeedbackNotice message="档案已保存" tone="success" /><FeedbackNotice message="新的记录已加入手记" /><FeedbackNotice message="里拉不足，暂时无法购买" tone="warning" /></section>
      <section><h2>事件结果</h2><EventResult {...task} /><EventResult title="北侧回廊" label="新区域开放" description="通往旧馆深处的门已经开启。" /></section>
      <section><h2>原位报错</h2><InlineFeedback message="档案未能写入，请重试。" action={{ label: "重试", onClick: () => {} }} /></section>
      <section><h2>{narrow ? "长文本与多奖励" : "物品获得"}</h2><EventResult {...item} {...(narrow ? {
        title: "留在旧馆深处的那封尚未寄出的信", description: "多项奖励在同一张面板内自然换行，不拆成连续弹窗。",
        rewards: [...task.rewards, ...item.rewards, { id: "long", kind: "item" as const, name: "一枚镌刻着旧日纹章的银质纪念勋章", quantity: 12, icon: key, rarity: "silver" as const }]
      } : {})} /></section>
    </div>
  </AbyssaProvider>;
}

const meta = {
  title: "Patterns/Scene Feedback", component: Playground,
  parameters: { layout: "fullscreen" }, args: { reduced: false }
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Overview: Story = { render: () => <Specimens /> };
export const Narrow: Story = { render: () => <Specimens narrow /> };
export const ReducedMotion: Story = { args: { reduced: true } };
export const FromRight: Story = { args: { edge: "right" } };
export const FromLeft: Story = { args: { edge: "left" } };
export const Stacked: Story = { args: { edge: "right", stacked: true } };
export const ApiError: Story = { render: () => <ApiErrorPreview /> };
export const ApiErrorNarrow: Story = { render: () => <ApiErrorPreview narrow /> };
