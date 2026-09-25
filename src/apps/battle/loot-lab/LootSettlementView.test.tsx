import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { LootSettlementView } from "../loot/LootSettlementView";
import { LOOT_ITEMS, sampleRun } from "./fixtures";
import { finishRun, type LootOutcome } from "./loot-model";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const receiptFor = (outcome: LootOutcome = "cleared", overflow = false) => finishRun(sampleRun(overflow ? "overflow" : "mixed"), outcome).settlement!;

function view(receipt = receiptFor(), onConfirm = vi.fn(), reduced = true) {
  return <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <LootSettlementView receipt={receipt} catalog={LOOT_ITEMS} context={{locationName: "旧日钟廊", progressLabel: "深处"}} onConfirm={onConfirm}/>
  </UiMotionProvider>;
}

describe("shared settlement presentation", () => {
  it("takes location/progress from its caller, exposes all 22 items and keeps unknown quality hidden", () => {
    const receipt = receiptFor("cleared", true);
    const original = structuredClone(receipt);
    render(view(receipt));
    const dialog = screen.getByRole("dialog", {name: "远征完成"});
    expect(dialog).toHaveTextContent("旧日钟廊");
    expect(dialog).toHaveTextContent("深处");
    expect(dialog).not.toHaveTextContent("庄园");
    expect(within(screen.getByRole("list", {name: "带回道具"})).getAllByRole("button")).toHaveLength(22);
    expect(screen.getByRole("button", {name: /封蜡小匣.*鉴定品，品质未知/})).toBeInTheDocument();
    expect(screen.getByRole("group", {name: `带回资金 ${receipt.returned.copper.toLocaleString("en-US")} G`})).toHaveTextContent(receipt.returned.copper.toLocaleString("en-US"));
    expect(receipt).toEqual(original);
  });

  it.each(["retreated", "failed"] as const)("shows the actual returned and lost pockets for %s without changing the receipt", outcome => {
    const receipt = receiptFor(outcome);
    const original = structuredClone(receipt);
    render(view(receipt));
    expect(screen.getByRole("group", {name: `带回资金 ${receipt.returned.copper.toLocaleString("en-US")} G`})).toBeInTheDocument();
    const loss = screen.getByRole("region", {name: "遗失记录"});
    expect(loss).toHaveTextContent("未入袋遗失");
    expect(loss).toHaveTextContent("封蜡小匣 ×1");
    if (outcome === "failed") expect(loss).toHaveTextContent("入袋折损");
    else expect(loss).not.toHaveTextContent("入袋折损");
    expect(receipt).toEqual(original);
  });

  it("the first click finishes the animation, the second deliberate return confirms", () => {
    const confirm = vi.fn();
    render(view(receiptFor(), confirm, false));
    fireEvent.click(screen.getByRole("button", {name: "返回"}));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("group", {name: "带回资金 4,850 G"})).toHaveTextContent("4,850");
    fireEvent.click(screen.getByRole("button", {name: "返回"}));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("keyboard skipping and Escape do not leave the result or reach the battle", () => {
    const confirm = vi.fn();
    render(view(receiptFor(), confirm, false));
    fireEvent.keyDown(screen.getByRole("region", {name: "远征收获明细"}), {key: "Enter"});
    expect(screen.getByRole("group", {name: "带回资金 4,850 G"})).toHaveTextContent("4,850");
    fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"});
    expect(confirm).not.toHaveBeenCalled();
  });

  it("reduced motion reveals immediately and does not require an extra click", () => {
    const confirm = vi.fn();
    render(view(receiptFor(), confirm));
    expect(screen.getByRole("group", {name: "带回资金 4,850 G"})).toHaveTextContent("4,850");
    fireEvent.click(screen.getByRole("button", {name: "返回"}));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("finishes on its own and a new receipt starts a fresh reveal", () => {
    vi.useFakeTimers();
    const confirm = vi.fn();
    const {rerender} = render(view(receiptFor(), confirm, false));
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByRole("group", {name: "带回资金 4,850 G"})).toHaveTextContent("4,850");
    rerender(view(receiptFor("failed"), confirm, false));
    fireEvent.click(screen.getByRole("button", {name: "返回"}));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("group", {name: "带回资金 1,300 G"})).toHaveTextContent("1,300");
  });

  it("allows an empty result and a context without any layer label", () => {
    render(<UiMotionProvider preference="reduced"><LootSettlementView receipt={finishRun(sampleRun("fresh"), "cleared").settlement!} catalog={LOOT_ITEMS} context={{locationName: "归途"}} onConfirm={() => {}}/></UiMotionProvider>);
    expect(screen.getByRole("dialog")).toHaveTextContent("暂无道具收获");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("第");
    expect(screen.getByRole("group", {name: "带回资金 0 G"})).toBeInTheDocument();
  });

  it("blocks submission while saving and exposes a deliberate retry after failure", () => {
    const confirm = vi.fn(), receipt = receiptFor();
    const renderResult = (busy: boolean, error?: string) => <UiMotionProvider preference="reduced"><LootSettlementView receipt={receipt} catalog={LOOT_ITEMS} context={{locationName: "归途"}} busy={busy} error={error} onConfirm={confirm}/></UiMotionProvider>;
    const {rerender} = render(renderResult(true));
    fireEvent.click(screen.getByRole("button", {name: "正在入账"}));
    expect(confirm).not.toHaveBeenCalled();
    rerender(renderResult(false, "保存失败，请重试。"));
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
    fireEvent.click(screen.getByRole("button", {name: "重试结算"}));
    expect(confirm).toHaveBeenCalledOnce();
  });
});
