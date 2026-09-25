import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SceneFeedback, EventResult, FeedbackNotice, InlineFeedback, type SceneFeedbackEntry } from "./SceneFeedback";
import { UiMotionProvider } from "../motion/UiMotionProvider";
import { feedbackAnnouncement } from "./feedback/FeedbackViews";
import { FeedbackDockContext } from "./feedback/FeedbackDockContext";

afterEach(cleanup);
const notice: SceneFeedbackEntry = { id: "n1", kind: "notice", tone: "success", message: "档案已保存", durationMs: null };
const result: SceneFeedbackEntry = { id: "r1", kind: "result", label: "委托完成", title: "旧馆的来信", durationMs: null, rewards: [
  { id: "lira", kind: "currency", currency: "lira", quantity: 120 },
  { id: "potion", kind: "item", name: "回复药", icon: "/potion.svg", rarity: "silver", quantity: 2 }
] };
const reward: SceneFeedbackEntry = {id: "item-1", kind: "reward", durationMs: null,
  reward: {id: "potion", kind: "item", name: "治疗药水", quantity: 2, icon: "/potion.svg"}};

it("sends pickups to the shared dock while keeping full event results at their original location",()=>{
  const report=vi.fn();
  render(<FeedbackDockContext.Provider value={report}><SceneFeedback dock entries={[reward,result]} onDismiss={()=>{}}/></FeedbackDockContext.Provider>);
  expect(report.mock.lastCall?.[1].entries).toEqual([reward]);
  expect(screen.getByText("旧馆的来信")).toBeInTheDocument();
  expect(screen.queryByText("治疗药水")).toBeNull();
});

it("groups one event's rewards without confirmation, focusable loot, or a dialog", () => {
  const view = render(<EventResult {...result} />);
  expect(screen.getByRole("heading", { name: "旧馆的来信" })).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "获得奖励" })).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("回复药")).toBeInTheDocument();
  expect(screen.getByLabelText("铜里拉 120 G")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("dialog")).toBeNull();
  expect(view.container.querySelectorAll(".abyssa-item-slot")).toHaveLength(1);
  expect(feedbackAnnouncement(result)).toBe("委托完成，旧馆的来信，铜里拉 120 G，回复药 ×2");
});

it("renders brief static notices and optional reward-free results", () => {
  const view = render(<FeedbackNotice message="里拉不足" tone="warning" />);
  expect(view.container.firstChild).toHaveAttribute("data-tone", "warning");
  expect(screen.getByText("里拉不足")).toBeInTheDocument();
  view.rerender(<EventResult title="北侧回廊" description="新的道路已经开放" />);
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.getByText("新的道路已经开放")).toBeInTheDocument();
});

it("keeps errors local and delegates only the explicit retry to the host", () => {
  const retry = vi.fn();
  const view = render(<InlineFeedback message="档案未能写入，请重试。" action={{ label: "重试", onClick: retry }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("档案未能写入");
  const button = screen.getByRole("button", { name: "重试" });
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveAttribute("data-shape", "chamfer");
  expect(button.querySelector(".abyssa-shape-button__content")).toHaveTextContent("重试");
  expect(button.querySelector("svg text")).toBeNull();
  act(() => button.focus()); expect(button).toHaveFocus();
  fireEvent.click(button); expect(retry).toHaveBeenCalledOnce();
  view.rerender(<InlineFeedback message="正在重试" tone="info" action={{ label: "重试", onClick: retry, disabled: true }} />);
  expect(screen.getByRole("status")).toHaveTextContent("正在重试");
  expect(screen.getByRole("button")).toBeDisabled();
  fireEvent.click(screen.getByRole("button")); expect(retry).toHaveBeenCalledOnce();
});

it("keeps raw errors collapsed, separate from the alert and reset for a new occurrence", () => {
  const retry = vi.fn();
  const details = { id: "request-1", status: 429, code: "rate_limit_exceeded", requestId: "req_demo_001", raw: 'HTTP 429\n{"message":"Too many requests"}' };
  const view = render(<InlineFeedback message="AI 服务繁忙，请稍后重试。" details={details} action={{ label: "重试", onClick: retry }} />);
  const disclosure = view.container.querySelector("details")!;
  const summary = disclosure.querySelector("summary")!;
  expect(disclosure.open).toBe(false);
  expect(screen.getByRole("alert")).not.toHaveTextContent("HTTP");
  // Native <details> keeps its children in the DOM while hiding them.
  expect(screen.getByRole("region", { name: "原始错误信息" })).not.toBeVisible();
  act(() => summary.focus()); fireEvent.click(summary);
  expect(disclosure.open).toBe(true);
  expect(summary).toHaveFocus();
  const raw = screen.getByRole("region", { name: "原始错误信息" });
  expect(raw.textContent).toBe(details.raw);
  expect(raw).toHaveAttribute("tabindex", "0");
  expect(document.getElementById(summary.getAttribute("aria-controls")!)).toContainElement(raw);
  expect(retry).not.toHaveBeenCalled();
  view.rerender(<InlineFeedback message="AI 服务繁忙，请稍后重试。" details={{ ...details }} action={{ label: "重试", onClick: retry }} />);
  expect(view.container.querySelector("details")).toBe(disclosure);
  expect(disclosure.open).toBe(true);
  fireEvent.click(summary); expect(disclosure.open).toBe(false);
  fireEvent.click(summary);
  view.rerender(<InlineFeedback message="连接超时" details={{ id: "request-2", raw: "TimeoutError: request timed out" }} />);
  expect(view.container.querySelector("details")!.open).toBe(false);
  expect(view.container).not.toHaveTextContent("Too many requests");
});

it("renders only safe plain-text diagnostics and no empty disclosure", () => {
  const raw = 'Authorization: Bearer preview-secret\n<script>alert("not executable")</script>';
  const view = render(<InlineFeedback message="认证失败" details={{ id: "auth", raw, status: 401 }} />);
  expect(view.container).not.toHaveTextContent("preview-secret");
  expect(view.container).toHaveTextContent("凭据已隐藏");
  fireEvent.click(view.container.querySelector("summary")!);
  expect(screen.getByRole("region", { name: "原始错误信息" }).textContent).toContain('<script>alert("not executable")</script>');
  expect(view.container.querySelector("script")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<InlineFeedback message="连接失败" details={{ id: "empty", raw: " \n " }} />);
  expect(view.container.querySelector("summary")).toBeNull();
});

it("never takes focus or consumes host input, and announces only the entered presentation", async () => {
  const advance = vi.fn(), dismiss = vi.fn();
  function Example({ entry }: { entry: SceneFeedbackEntry | null }) {
    return <UiMotionProvider preference="reduced"><div onKeyDown={advance}>
      <button>下一步</button><SceneFeedback entry={entry} onDismiss={dismiss} />
    </div></UiMotionProvider>;
  }
  const view = render(<Example entry={null} />);
  const button = screen.getByRole("button"); act(() => button.focus());
  view.rerender(<Example entry={notice} />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("档案已保存"));
  expect(button).toHaveFocus(); fireEvent.keyDown(button, { key: "Enter" }); expect(advance).toHaveBeenCalledOnce();
  view.rerender(<Example entry={null} />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(dismiss).not.toHaveBeenCalled(); expect(button).toHaveFocus();
});

it("updates same-id content in place and serializes different ids, including rapid replacement", async () => {
  const dismiss = vi.fn();
  const wrap = (entry: SceneFeedbackEntry) => <UiMotionProvider preference="reduced"><SceneFeedback entry={entry} onDismiss={dismiss} /></UiMotionProvider>;
  const view = render(wrap(notice));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("档案已保存"));
  const first = view.container.querySelector(".scene-feedback__presentation");
  view.rerender(wrap({ ...notice, message: "档案已更新" }));
  expect(view.container.querySelector(".scene-feedback__presentation")).toBe(first);
  expect(screen.getByRole("status")).toHaveTextContent("档案已更新");
  view.rerender(wrap(result));
  expect(first).toHaveAttribute("data-present", "false");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  view.rerender(wrap({ ...notice, id: "latest", message: "最新提示" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("最新提示"));
  expect(view.container.querySelectorAll(".scene-feedback__presentation")).toHaveLength(1);
  expect(dismiss).not.toHaveBeenCalled();
});

it("lets the host dismiss after readable dwell and fully removes the fading surface", async () => {
  const dismiss = vi.fn();
  function Example() {
    const [entry, setEntry] = useState<SceneFeedbackEntry | null>({ ...notice, durationMs: 30 });
    return <UiMotionProvider preference="reduced"><SceneFeedback entry={entry} onDismiss={id => { dismiss(id); setEntry(null); }} /></UiMotionProvider>;
  }
  const view = render(<Example />);
  expect(dismiss).not.toHaveBeenCalled();
  await waitFor(() => expect(dismiss).toHaveBeenCalledExactlyOnceWith("n1"));
  await waitFor(() => expect(view.container.querySelector(".scene-feedback__presentation")).toBeNull());
});

it("appends feedback below existing entries without replacing them or stealing focus", async () => {
  const dismiss = vi.fn();
  const wrap = (entries: SceneFeedbackEntry[]) => <UiMotionProvider preference="reduced">
    <button>继续操作</button><SceneFeedback entries={entries} edge="right" onDismiss={dismiss}/>
  </UiMotionProvider>;
  const view = render(wrap([notice]));
  const button = screen.getByRole("button"); act(() => button.focus());
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("档案已保存"));
  const first = view.container.querySelector(".scene-feedback__presentation");
  view.rerender(wrap([notice, reward]));
  await waitFor(() => expect(screen.getAllByRole("status").map(node => node.textContent))
    .toEqual(["档案已保存", "获得道具，治疗药水 ×2"]));
  expect(view.container.querySelector(".scene-feedback__presentation")).toBe(first);
  expect(first).toHaveAttribute("data-present", "true");
  expect(button).toHaveFocus();
  const acquisition = view.container.querySelectorAll(".scene-feedback__presentation")[1];
  view.rerender(wrap([reward, {...notice, id: "next", message: "下一条提示"}]));
  expect(first).toHaveAttribute("data-present", "false");
  await waitFor(() => expect(screen.getAllByRole("status").map(node => node.textContent))
    .toEqual(["获得道具，治疗药水 ×2", "下一条提示"]));
  expect(view.container.querySelector(".scene-feedback__presentation")).toBe(acquisition);
  expect(dismiss).not.toHaveBeenCalled();
});

it("expires stacked entries independently and does not restart an older receipt on append", async () => {
  const dismiss = vi.fn();
  function Example() {
    const [entries, setEntries] = useState<SceneFeedbackEntry[]>([{...notice, durationMs: 300}]);
    return <UiMotionProvider preference="reduced">
      <button onClick={() => setEntries(current => [...current, {...reward, durationMs: null}])}>获得道具</button>
      <SceneFeedback entries={entries} onDismiss={id => {dismiss(id); setEntries(current => current.filter(entry => entry.id !== id));}}/>
    </UiMotionProvider>;
  }
  const view = render(<Example/>);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("档案已保存"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(2));
  await waitFor(() => expect(dismiss).toHaveBeenCalledExactlyOnceWith("n1"));
  await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(1));
  expect(screen.getByRole("status")).toHaveTextContent("获得道具，治疗药水 ×2");
  expect(view.container.querySelector(".scene-feedback__reward")).toHaveTextContent("获得道具治疗药水×2");
});
