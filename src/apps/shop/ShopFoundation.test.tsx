import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { playShopTutorial, shopFixture } from "../../game-application/testing/shop-foundation-fixture";
import type { D5GameRecord } from "../../game-application";
import { GameStorageError } from "../../game-application/contracts";
import { GameSession } from "../../game-client/session";
import { SceneTransitionProvider } from "../../shared/transition";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { ShopPage } from "./ShopPage";

let claimed: D5GameRecord, session: GameSession, f: ReturnType<typeof shopFixture>;
vi.mock("../../game-client/react", async original => {
  const actual = await original<typeof import("../../game-client/react")>();
  return {...actual, GameProvider: ({children}: {children: React.ReactNode}) => <actual.GameSessionScope session={session}>{children}</actual.GameSessionScope>};
});
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
beforeAll(async () => {claimed = (await playShopTutorial()).checkpoints.claimed;}, 90_000);
beforeEach(async () => {
  f = shopFixture(claimed);
  session = new GameSession(f.runtime, {saveId: claimed.head.saveId, epoch: claimed.head.epoch}, sessionStorage);
  await session.refresh();
  location.hash = "#/shop?mode=appraise";
}, 30_000);
afterEach(() => {cleanup(); session.dispose(); sessionStorage.clear();});
const mount = async () => {const view = render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopPage/></SceneTransitionProvider></UiMotionProvider>); await screen.findByRole("tab", {name: "鉴定"}); return view;};

it("uses real owned loot, charges once, retains the result across remount, sells and purchases", async () => {
  const first = await mount();
  expect(screen.getByRole("tab", {name: /鉴定/})).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("listbox", {name: "待鉴定与已鉴定物品"})).toBeInTheDocument();
  expect(screen.getByLabelText("持有 1 件")).toBeInTheDocument();
  expect(screen.getByLabelText("远古晶石余额 0")).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "鉴定"})).toBeEnabled();
  fireEvent.click(screen.getByRole("option", {name: "结着盐壳的铜环"}));
  expect(screen.getByRole("heading", {name: "结着盐壳的铜环"})).toBeInTheDocument();
  expect(screen.getByRole("group", {name: "库存预览"})).toHaveTextContent("持有1");
  fireEvent.click(screen.getByRole("button", {name: "鉴定"}));
  await waitFor(() => expect(screen.getByLabelText("小队资金余额 4,900 G")).toBeInTheDocument(), {timeout: 15_000});
  expect(screen.getByRole("heading", {name: "旧船灯的平衡环"})).toBeInTheDocument();
  expect(document.querySelector(".new-shop__merchant button")).toBeNull();
  expect(document.querySelector(".new-shop-detail .new-shop__action")).toBeEnabled();
  fireEvent.click(screen.getByRole("region", {name: "缇比的对话"}));
  fireEvent.click(screen.getByRole("button", {name: /继续鉴定/}));
  fireEvent.click(screen.getByRole("region", {name: "缇比的对话"}));
  expect(screen.getByRole("region", {name: "缇比的对话"})).toHaveTextContent("你拿回来的只有架子");
  fireEvent.click(screen.getByRole("button", {name: "收好"}));
  const retained = f.read();
  first.unmount();
  await act(() => session.refresh());
  await mount();
  expect(screen.getByRole("option", {name: "旧船灯的平衡环"})).toHaveTextContent("已鉴定");
  expect(screen.queryByRole("button", {name: "鉴定"})).not.toBeInTheDocument();
  expect(f.read()).toEqual(retained);
  fireEvent.click(screen.getByRole("tab", {name: "出售"}));
  expect(screen.getByRole("listbox", {name: "可出售物品"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", {name: /旧船灯的平衡环/}));
  fireEvent.click(screen.getByRole("button", {name: "出售"}));
  await waitFor(() => expect(screen.getByLabelText("小队资金余额 5,700 G")).toBeInTheDocument(), {timeout: 15_000});
  expect(f.read().snapshot.campaign.loot).toEqual([]);
  fireEvent.click(screen.getByRole("tab", {name: "鉴定"}));
  fireEvent.click(screen.getByRole("button", {name: "鉴定记录"}));
  expect(screen.getByRole("region", {name: "鉴定记录"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: /旧船灯的平衡环/}));
  expect(screen.getByRole("button", {name: "鉴定记录"})).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("region", {name: "缇比的对话"}));
  fireEvent.click(screen.getByRole("button", {name: /继续鉴定/}));
  fireEvent.click(screen.getByRole("region", {name: "缇比的对话"}));
  expect(screen.getByRole("region", {name: "缇比的对话"})).toHaveTextContent("你拿回来的只有架子");
  expect(f.read().snapshot.campaign.funds.party).toBe(57);
  fireEvent.click(screen.getByRole("tab", {name: "购买"}));
  fireEvent.click(screen.getByRole("option", {name: /圣水/}));
  fireEvent.click(screen.getByRole("button", {name: "购买"}));
  await waitFor(() => expect(screen.getByLabelText("小队资金余额 5,400 G")).toBeInTheDocument(), {timeout: 15_000});
  expect(f.read().snapshot.campaign.supplies.find(item => item.definitionId === "item.holy-water")?.charges).toBe(1);
}, 45_000);

it("shows why unknown loot cannot be sold and returns to appraisal without a transaction", async () => {
  await mount();
  fireEvent.click(screen.getByRole("tab", {name: "出售"}));
  expect(screen.getByText("先请缇比看看，再谈价钱。")).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "出售"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "去鉴定"}));
  expect(screen.getByRole("option", {name: "结着盐壳的铜环"})).toBeInTheDocument();
  expect(f.read()).toEqual(claimed);
});

it("recovers a lost response in the real page and replaces stale transaction errors", async () => {
  await mount();
  fireEvent.click(screen.getByRole("option", {name: "结着盐壳的铜环"}));
  for (const [button, funds] of [["鉴定", 49], ["出售", 57]] as const) {
    const commit = f.store.commit.bind(f.store); let armed = true;
    f.store.commit = async plan => {
      const result = await commit(plan);
      if (armed) {armed = false; throw new GameStorageError("storage-unavailable", "response lost");}
      return result;
    };
    fireEvent.click(screen.getByRole("button", {name: button}));
    await waitFor(() => expect(session.getSnapshot().status).toBe("error"), {timeout: 15_000});
    expect(f.read().snapshot.campaign.funds.party).toBe(funds);
    fireEvent.click(screen.getByRole("button", {name: "重新读取 / 重试"}));
    await waitFor(() => expect(session.getSnapshot().status).toBe("ready"), {timeout: 15_000});
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    if (button === "出售") expect(document.querySelector(".new-shop__feedback .scene-feedback__notice")).toHaveTextContent("收入 800 G");
    else expect(screen.getByRole("button", {name: "收好"})).toBeEnabled();
    expect(session.getSnapshot().status).toBe("ready");
    expect(f.read().snapshot.campaign.funds.party).toBe(funds);
    f.store.commit = commit;
    if (button === "鉴定") {
      fireEvent.click(screen.getByRole("button", {name: "收好"}));
      fireEvent.click(screen.getByRole("button", {name: "去出售"}));
      fireEvent.click(screen.getByRole("option", {name: /旧船灯的平衡环/}));
    }
  }
  expect(f.read().snapshot.campaign.lootTrades).toHaveLength(2);
}, 45_000);
