import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ShopVisit } from "./ShopVisit";
import { ShopCounter } from "./ShopCounter";
import { SceneTransitionProvider } from "../../shared/transition";
import { SCENE_SEQUENCE_MS as ms } from "../../shared/presentation/adv/SceneSequence";
import { shopIntroduction } from "../../content/presentation/shop-introduction";
import { SHOP_INTRODUCTION_CATALOG } from "../../game-runtime/shop-introduction-context";

vi.mock("../../shared/loading/images", () => ({prepareImages: () => Promise.resolve()}));
afterEach(() => {cleanup(); vi.useRealTimers();});
const tick = async (time: number) => act(async () => {await vi.advanceTimersByTimeAsync(time);});

it("establishes the location, types the greeting, changes expression, and waits for committed progress", async () => {
  vi.useFakeTimers();
  const onAdvance = vi.fn(), onExit = vi.fn();
  const draw = (step: number, busy = false) => <SceneTransitionProvider>
    <ShopVisit introduction={{step}} busy={busy} onAdvance={onAdvance} onExit={onExit}><p>柜台</p></ShopVisit>
  </SceneTransitionProvider>;
  const view = render(draw(0));
  await tick(0);
  expect(view.container.querySelector(".scene-sequence")).toHaveAttribute("data-phase", "arrival");
  expect(screen.queryByRole("main", {name: shopIntroduction.title})).toBeNull();
  await tick(ms.arrival); await tick(ms.advIn);
  const main = screen.getByRole("main", {name: shopIntroduction.title});
  expect(main).toHaveAttribute("data-state", "typing");
  const stage = screen.getByRole("region", {name: "AVG 对话"});
  fireEvent.keyDown(stage, {key: "Enter"});
  expect(onAdvance).not.toHaveBeenCalled();
  expect(main).toHaveAttribute("data-state", "idle");
  fireEvent.keyDown(stage, {key: "Enter"});
  expect(onAdvance).toHaveBeenCalledWith("continue");
  expect(main).toHaveAttribute("data-frame-id", "shop.first-visit.0");
  const base = view.container.querySelector('[data-character="tibby"] [data-part="base"]');
  view.rerender(draw(1));
  expect(main).toHaveAttribute("data-state", "typing");
  expect(main).toHaveAttribute("data-frame-id", "shop.first-visit.1");
  expect(view.container.querySelector('[data-character="tibby"]')).toHaveAttribute("data-expression", "i");
  expect(view.container.querySelector('[data-character="tibby"] [data-part="base"]')).toBe(base);
  expect(view.container.querySelector(".scene-sequence")).toHaveAttribute("data-phase", "idle");
  view.rerender(draw(1, true));
  expect(screen.getByRole("button", {name: "跳过本段对白"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "返回洋馆"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "返回洋馆"}).querySelector('[data-glyph="back"]')).toBeInTheDocument();
  view.rerender(draw(1));
  fireEvent.click(screen.getByRole("button", {name: "返回洋馆"}));
  expect(onExit).toHaveBeenCalledOnce();
});

it.each([true, false])("hands off to one scaled counter only after the save resolves (resume=%s)", async resumed => {
  vi.useFakeTimers();
  const onAdvance = vi.fn();
  const draw = (step: number | null) => <SceneTransitionProvider>
    <ShopVisit introduction={step === null ? null : {step}} busy={false} onAdvance={onAdvance} onExit={() => {}}>
      <ShopCounter embedded products={[]} funds={49} crystals={0} busy={false} available onPurchase={async () => null}/>
    </ShopVisit>
  </SceneTransitionProvider>;
  const view = render(draw(resumed ? 2 : 0));
  await tick(0);
  if (!resumed) await tick(ms.arrival);
  else expect(view.container.querySelector(".scene-sequence__arrival")).toBeNull();
  await tick(ms.advIn);
  expect(screen.queryByRole("tab", {name: "购买"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "跳过本段对白"}));
  await tick(32);
  expect(onAdvance).toHaveBeenCalledWith("continue");
  expect(onAdvance).not.toHaveBeenCalledWith("skip");
  const last = shopIntroduction.lines.length - 1;
  view.rerender(draw(last)); await tick(10000);
  expect(onAdvance).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", {name: "跳过本段对白"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name: "看看柜台"}));
  expect(onAdvance).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("tab", {name: "购买"})).toBeNull();
  view.rerender(draw(null));
  expect(view.container.querySelector(".scene-sequence")).toHaveAttribute("data-phase", "out");
  await tick(ms.advOut); await tick(ms.battleIn); await tick(480);
  expect(view.container.querySelectorAll(".abyssa-stage__canvas")).toHaveLength(1);
  expect(screen.queryByRole("main", {name: shopIntroduction.title})).toBeNull();
  expect(screen.getByRole("tab", {name: "购买"})).toBeEnabled();
  expect(screen.getByLabelText("小队资金余额 49 G")).toBeInTheDocument();
  expect(view.container.querySelector(".new-shop")).toHaveAttribute("data-shop-intro", "ready");
  expect(view.container.querySelector(".new-shop")).toHaveAttribute("data-entry-profile", "handoff");
  expect(SHOP_INTRODUCTION_CATALOG.data.shopIntroduction?.lastStep).toBe(shopIntroduction.lines.length - 1);
});
