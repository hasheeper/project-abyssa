import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { startOrdinaryDrops, playOrdinaryDrops, settleOrdinaryDrops } from "../../game-application/testing/ordinary-drops-fixture";
import { GameSession } from "../../game-client/session";
import { SceneTransitionProvider } from "../../shared/transition";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { ShopPage } from "./ShopPage";

let session: GameSession;
vi.mock("../../game-client/react", async original => {
  const actual = await original<typeof import("../../game-client/react")>();
  return {...actual, GameProvider: ({children}: {children: React.ReactNode}) => <actual.GameSessionScope session={session}>{children}</actual.GameSessionScope>};
});
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
afterEach(() => {cleanup(); session?.dispose(); sessionStorage.clear();});

it("trades earned content-21 stacks and a paid curio after completing the first SHOP visit", async () => {
  const f = await startOrdinaryDrops("tide-reef.ordinary");
  const {terminal} = await playOrdinaryDrops(f, "clear"); await settleOrdinaryDrops(f);
  // The shortcut owns the tutorial lots, so it must now finish the real first
  // visit before the ordinary counter becomes available. Do not bypass its gate.
  await f.commit({type: "begin-shop-visit", shopId: "shop.mansion"});
  for (let step = 0; step < 100 && f.read().snapshot.campaign.shopVisit?.status !== "completed"; step++) {
    const progress = f.read().snapshot.campaign.shopVisit!;
    const quoteVersion = f.runtime.queries.shop(f.read())!.loot!.quoteVersion;
    if (progress.phase === "appraise" || progress.phase === "sell") {
      await f.commit({type: progress.phase === "appraise" ? "appraise-shop-visit" : "sell-shop-visit", shopId: "shop.mansion", quoteVersion});
    } else {
      await f.commit({type: "advance-shop-visit", shopId: "shop.mansion", phase: progress.phase, step: progress.step,
        choice: progress.phase === "valuation" && progress.step === 17 ? "A" : "continue"});
    }
  }
  expect(f.read().snapshot.campaign.shopVisit?.status).toBe("completed");
  expect(f.runtime.queries.shop(f.read())!.firstVisit).toBeNull();
  const inventory = f.read().snapshot.campaign.loot!;
  const duplicate = inventory.find(item => item.resultId && item.definitionId.startsWith("loot.salvage.") && inventory.filter(other => other.definitionId === item.definitionId).length >= 2)!;
  const curio = terminal.returnedLoot!.find(item => !f.catalog.data.loot!.definitions[item.definitionId].initiallyKnown)!;
  expect(duplicate).toBeDefined(); expect(curio).toBeDefined();
  session = new GameSession(f.runtime, {saveId: f.saveId, epoch: f.read().head.epoch}, sessionStorage);
  await session.refresh(); location.hash = "#/shop";
  render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopPage/></SceneTransitionProvider></UiMotionProvider>);
  await screen.findByRole("tab", {name: "出售"}); fireEvent.click(screen.getByRole("tab", {name: "出售"}));
  const name = shopLootPresentation[duplicate.definitionId].name;
  for (let page = 0; page < 3 && !screen.queryByRole("option", {name}); page++) fireEvent.click(screen.getByRole("button", {name: "下一页"}));
  fireEvent.click(screen.getByRole("option", {name}));
  fireEvent.click(screen.getByRole("button", {name: "增加数量"}));
  const beforeSale = f.read().snapshot.campaign.funds.party;
  const price = f.catalog.data.loot!.definitions[duplicate.definitionId].salePrice;
  fireEvent.click(screen.getByRole("button", {name: "出售"}));
  await waitFor(() => expect(session.getSnapshot().record!.snapshot.campaign.funds.party).toBe(beforeSale + price * 2), {timeout: 15000});
  expect(f.read().snapshot.campaign.loot!.filter(item => item.definitionId === duplicate.definitionId)).toHaveLength(inventory.filter(item => item.definitionId === duplicate.definitionId).length - 2);
  expect(document.querySelector(".scene-feedback__notice")).toHaveTextContent(`${name} ×2`);

  fireEvent.click(screen.getByRole("tab", {name: "鉴定"}));
  const art = shopLootPresentation[curio.definitionId];
  fireEvent.click(screen.getByRole("option", {name: art.unknownName}));
  const beforeAppraisal = f.read().snapshot.campaign.funds.party;
  fireEvent.click(screen.getByRole("button", {name: "鉴定"}));
  await waitFor(() => expect(session.getSnapshot().record!.snapshot.campaign.funds.party).toBe(beforeAppraisal - 300), {timeout: 15000});
  expect(screen.getByRole("heading", {name: art.name})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "收好"}));
  fireEvent.click(screen.getByRole("button", {name: "去出售"}));
  expect(screen.getByRole("option", {name: art.name})).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("button", {name: "出售"}));
  await waitFor(() => expect(session.getSnapshot().record!.snapshot.campaign.funds.party).toBe(beforeAppraisal - 300 + f.catalog.data.loot!.definitions[curio.definitionId].salePrice), {timeout: 15000});
  expect(f.read().snapshot.campaign.loot!.some(item => item.instanceId === curio.instanceId)).toBe(false);
  await act(() => session.refresh());
  expect(session.getSnapshot().status).toBe("ready");
}, 120_000);
