import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AbyssaProvider } from "../primitives/AbyssaProvider";
import { RpgModal } from "../primitives/RpgModal";
import { RpgNotchedPillButton } from "../primitives/RpgNotchedPillButton";
import { RibbonButton } from "../primitives/RibbonButton";
import { IconButton } from "../primitives/IconButton";
import { RpgFrame } from "../primitives/RpgFrame";
import { Nameplate } from "../primitives/Nameplate";
import { UiContentTransition } from "./UiContentTransition";
import "./page-board.css";

function PageBoardPreview({ reduced }: { reduced: boolean }) {
  const [replay, setReplay] = useState(0);
  return <AbyssaProvider motionPreference={reduced ? "reduced" : "system"} style={{ width: 740, padding: 30 }}>
    <RpgNotchedPillButton label="重播木板入场" onClick={() => setReplay(value => value + 1)}/>
    <RpgFrame key={replay} data-testid="page-board-preview" padding="lg"
      style={{ marginTop: 48, minHeight: 320, transform: "scale(.96)", animation: "var(--abyssa-motion-page-board-enter)" }}>
      <Nameplate name="实体木板" secondaryName="PAGE BOARD"/>
      <p>角色、商店、出征正在使用的同一份主板预设。</p>
      <p>只负责框体缓落与显现；各页立绘、TAB 和正文的层次时序仍由页面编排。</p>
      <p>保留原有缩放和点击区域，不新增动画容器。</p>
    </RpgFrame>
  </AbyssaProvider>;
}

function Presets({ reduced = false, preset = "surface" }: { reduced?: boolean; preset?: "surface" | "manor" | "page-board" }) {
  const [open, setOpen] = useState(false), [content, setContent] = useState(0);
  const frame = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  if (preset === "page-board") return <PageBoardPreview reduced={reduced}/>;
  return <AbyssaProvider motionPreference={reduced ? "reduced" : "system"}>
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <RpgNotchedPillButton label="打开日志" onClick={() => setOpen(true)}/>
      <RibbonButton onClick={() => setOpen(true)}>打开日志</RibbonButton>
      <IconButton label="不可用" icon="close" disabled/>
    </div>
    <RpgModal open={open} title={preset === "manor" ? "洋馆功能窗" : "统一预设"} onClose={() => setOpen(false)}
      className={preset === "manor" ? "manor-utility" : undefined}
      panelClassName={preset === "manor" ? "manor-utility__window" : undefined}
      motionPreset={preset} signboard={preset === "manor" ? "洋馆功能窗" : undefined} signboardVariant="slim">
      <UiContentTransition contentKey={content}><p>记录 {content + 1}：内容即时更新，窗口不重新入场。</p></UiContentTransition>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <RpgNotchedPillButton label="下一条" onClick={() => setContent(value => value + 1)}/>
        <RpgNotchedPillButton label="关闭中重开" onClick={() => {
          setOpen(false);
          frame.current = requestAnimationFrame(() => setOpen(true));
        }}/>
      </div>
    </RpgModal>
  </AbyssaProvider>;
}

const meta = { title: "Foundation/UI Motion", component: Presets, args: { reduced: false, preset: "surface" } } satisfies Meta<typeof Presets>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Standard: Story = {};
export const Reduced: Story = { args: { reduced: true } };
export const PageBoard: Story = { args: { preset: "page-board" } };
export const PageBoardReduced: Story = { args: { preset: "page-board", reduced: true } };
export const Manor: Story = { args: { preset: "manor" } };
export const ManorReduced: Story = { args: { preset: "manor", reduced: true } };
