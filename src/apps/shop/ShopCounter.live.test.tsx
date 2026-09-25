import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { ShopCounter, type ShopCounterProps } from "./ShopCounter";
import type { ShopLootItem } from "./shop-loot-model";
import { presentGeneratedShopLoot } from "./generated-shop-loot";
import type { PublicAppraisal } from "../../game-core/contracts/expedition-appraisal";
import { itemIconCatalog } from "../../assets/icons/items/catalog";
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
vi.setConfig({testTimeout: 15_000});
afterEach(cleanup);
const unknown: ShopLootItem = {...shopLootPresentation["loot.tutorial.curio"], instanceId: "curio-1", resultId: null, appraisalFee: 2, salePrice: 8};
const known = {...unknown, resultId: "ring"};
const products: ShopCounterProps["products"] = [
  {id: "ward", name: "护符", iconUrl: "/ward.svg", description: "护住队员", owned: 0, capacity: 2, price: 4, category: "battle"},
  {id: "slip", name: "卦签", iconUrl: "/slip.svg", description: "探路", owned: 0, capacity: 2, price: 3, category: "exploration"},
];
const props = (extra: Partial<ShopCounterProps> = {}): ShopCounterProps => ({
  products, funds: 49, crystals: 7, available: true, busy: false, loot: {items: [unknown], history: []},
  onPurchase: vi.fn(async () => null), onAppraise: vi.fn(async () => null), onSell: vi.fn(async () => null), ...extra,
});
const scene = (input: ShopCounterProps) => <UiMotionProvider preference="reduced"><ShopCounter {...input}/></UiMotionProvider>;
const start = async (input: ShopCounterProps) => {const view = render(scene(input)); await screen.findByRole("tab", {name: "购买"}); return view;};
const action = (name: string) => screen.getByRole("button", {name});
const mode = (name: string) => fireEvent.click(screen.getByRole("tab", {name}));

const publicCopy: PublicAppraisal = {unknownName: "蜡封的锁盒", appearance: "盒沿留着细小刻痕。", selectUnknown: {text: "先别打开，蜡还封着呢。", emotion: "confused"}, identified: null};
const revealedCopy: PublicAppraisal = {...publicCopy, identified: {name: "旧港记筹木箱", description: "用来存放进港记筹的小盒。", rarity: "silver",
  selectKnown: {text: "这笔旧账倒比你的好认呢。", emotion: "wry"}, appraisal: [{text: "旧港的记筹盒。每一道刻痕都对着一条船。", emotion: "confident"}, {text: "盒子还能用，里面的账可没人认啦。", emotion: "smile"}], sold: {text: "收下啦，这回轮到我付钱。", emotion: "smile"}}};
const generatedUnknown: ShopLootItem = {...presentGeneratedShopLoot(publicCopy), instanceId: "generated:1", definitionId: "loot.curio.clock-reed", resultId: null, appraisalFee: 300, salePrice: 2, sellable: true, stackable: false};
const generatedKnown: ShopLootItem = {...generatedUnknown, ...presentGeneratedShopLoot(revealedCopy), resultId: "appraisal.clock-reed", salePrice: 1200};

it("plays generated selection, appraisal and sale lines only in the small shop dialogue after the committed trade", async () => {
  const onAppraise = vi.fn().mockResolvedValueOnce("保存未确认").mockResolvedValueOnce(null);
  const input = props({initialMode: "appraise", funds: 2000, loot: {items: [generatedUnknown], history: []}, onAppraise});
  const view = await start(input);
  fireEvent.click(screen.getByRole("option", {name: generatedUnknown.unknownName}));
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(publicCopy.selectUnknown.text);
  expect(document.body).not.toHaveTextContent(generatedKnown.name);
  const unknownIcon = itemIconCatalog.find(item => item.id === "locked-box")!.assetUrl;
  const knownIcon = itemIconCatalog.find(item => item.id === "wooden-crate")!.assetUrl;
  expect(screen.getByRole("option", {name: generatedUnknown.unknownName}).querySelector('[data-layer="glyph"]')).toHaveStyle({maskImage: `url("${unknownIcon}")`});
  expect(document.querySelector('.new-shop-detail [data-layer="glyph"]')).toHaveStyle({maskImage: `url("${unknownIcon}")`});
  await act(async () => fireEvent.click(action("鉴定")));
  expect(screen.getByRole("alert")).toHaveTextContent("保存未确认");
  expect(document.body).not.toHaveTextContent(generatedKnown.name);
  expect(document.querySelector('.new-shop-detail [data-layer="glyph"]')).toHaveStyle({maskImage: `url("${unknownIcon}")`});
  await act(async () => fireEvent.click(action("鉴定")));
  const appraisal = {id: "generated:appraise", kind: "appraise" as const, gold: 300, item: generatedKnown};
  view.rerender(scene({...input, funds: 1700, loot: {items: [generatedKnown], history: [appraisal]}}));
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(generatedKnown.appraisal[0].text);
  expect(screen.getByRole("option", {name: generatedKnown.name}).querySelector('[data-layer="glyph"]')).toHaveStyle({maskImage: `url("${knownIcon}")`});
  expect(document.querySelector('.new-shop-detail [data-layer="glyph"]')).toHaveStyle({maskImage: `url("${knownIcon}")`});
  expect(document.querySelector(".story-reading, .rp-adv, .adv-stage")).toBeNull();
  fireEvent.click(action("继续鉴定")); fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(generatedKnown.appraisal[1].text);
  fireEvent.click(action("收好"));
  fireEvent.click(screen.getByRole("option", {name: generatedKnown.name})); fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(revealedCopy.identified!.selectKnown.text);
  fireEvent.click(action("去出售"));
  await act(async () => fireEvent.click(action("出售")));
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(revealedCopy.identified!.sold.text);
  expect(input.onSell).toHaveBeenCalledExactlyOnceWith(generatedKnown.instanceId);
  expect(onAppraise).toHaveBeenCalledTimes(2);
});

it("keeps generated instances separate and never reveals identified copy when selling one as unknown scrap", async () => {
  const second = {...generatedUnknown, instanceId: "generated:2", unknownName: "盐封小盒"};
  const input = props({initialMode: "sell", funds: 2000, loot: {items: [generatedUnknown, second], history: []}});
  await start(input);
  expect(screen.getAllByRole("option")).toHaveLength(2);
  fireEvent.click(screen.getByRole("option", {name: second.unknownName}));
  await act(async () => fireEvent.click(action("出售")));
  expect(input.onSell).toHaveBeenCalledExactlyOnceWith(second.instanceId);
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent("按废料收下啦");
  expect(document.body).not.toHaveTextContent(generatedKnown.name);
  expect(document.body).not.toHaveTextContent(revealedCopy.identified!.sold.text);
});

it("uses live balances and categories, omits lab controls, and locks one pending purchase without inventing stock", async () => {
  let finish!: (error: string | null) => void;
  const input = props({onPurchase: vi.fn(() => new Promise<string | null>(resolve => {finish = resolve;}))});
  const view = await start(input);
  expect(screen.getByLabelText("远古晶石余额 7")).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "重播进场"})).toBeNull();
  expect(document.querySelector("[data-shop-depth]")).toBeNull();
  mode("探索"); expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", {name: "卦签"})).toBeInTheDocument();
  mode("全部"); fireEvent.click(screen.getByRole("option", {name: "护符"}));
  fireEvent.click(action("增加数量"));
  fireEvent.click(action("购买")); fireEvent.click(action("处理中"));
  expect(input.onPurchase).toHaveBeenCalledExactlyOnceWith("ward", 2);
  expect(action("减少数量")).toBeDisabled();
  expect(screen.getByRole("tab", {name: "出售"})).toBeDisabled();
  expect(screen.getByLabelText("小队资金余额 49 G")).toBeInTheDocument();
  expect(document.querySelector(".scene-feedback__reward")).toBeNull();
  view.rerender(scene({...input, funds: 41, products: [{...products[0], owned: 2}, products[1]]}));
  await act(async () => finish(null));
  expect(screen.getByLabelText("小队资金余额 41 G")).toBeInTheDocument();
  expect(action("已备足")).toBeDisabled();
  expect(document.querySelector(".scene-feedback__reward")).toHaveTextContent("获得道具护符×2");
});

it("shows a failed write, keeps money and inventory intact, and only reports a successful retry", async () => {
  const onPurchase = vi.fn().mockResolvedValueOnce("交易未能确认").mockResolvedValueOnce(null);
  await start(props({onPurchase}));
  await act(async () => fireEvent.click(action("购买")));
  expect(screen.getByRole("alert")).toHaveTextContent("交易未能确认");
  expect(document.querySelector(".scene-feedback__reward")).toBeNull();
  expect(screen.getByLabelText("小队资金余额 49 G")).toBeInTheDocument();
  await act(async () => fireEvent.click(action("购买")));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelectorAll(".scene-feedback__reward")).toHaveLength(1);
});

it("appraises once, retains the result, sells the exact instance and recalls sold records for free", async () => {
  const input = props({initialMode: "appraise"});
  const view = await start(input);
  await act(async () => fireEvent.click(action("鉴定")));
  expect(input.onAppraise).toHaveBeenCalledExactlyOnceWith(unknown.instanceId);
  const appraisal = {id: "appraise-1", kind: "appraise" as const, gold: 2, item: known};
  view.rerender(scene({...input, funds: 47, loot: {items: [known], history: [appraisal]}}));
  expect(screen.getByRole("heading", {name: known.name})).toBeInTheDocument();
  expect(document.querySelector(".new-shop-detail .new-shop__action")).toBeEnabled();
  expect(document.querySelector(".new-shop__merchant button")).toBeNull();
  fireEvent.click(action("收好"));
  expect(action("去出售")).toBeEnabled();
  fireEvent.click(action("去出售"));
  await act(async () => fireEvent.click(action("出售")));
  expect(input.onSell).toHaveBeenCalledExactlyOnceWith(known.instanceId);
  const sold = {id: "sell-1", kind: "sell" as const, gold: 8, item: known};
  view.rerender(scene({...input, funds: 55, loot: {items: [], history: [appraisal, sold]}}));
  expect(screen.getByRole("heading", {name: "暂无可出售物品"})).toHaveFocus();
  mode("鉴定"); fireEvent.click(action("鉴定记录"));
  fireEvent.click(within(screen.getByRole("region", {name: "鉴定记录"})).getByRole("button", {name: known.name}));
  expect(screen.getByRole("heading", {name: known.name})).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  fireEvent.click(action("继续鉴定"));
  fireEvent.click(screen.getByLabelText("缇比的对话"));
  expect(screen.getByLabelText("缇比的对话")).toHaveTextContent(known.appraisal[1].text);
  expect(input.onAppraise).toHaveBeenCalledTimes(1);
  expect(input.onSell).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("小队资金余额 55 G")).toBeInTheDocument();
});

it.each(["appraise", "sell"] as const)("recovers an uncertain %s from committed history without sending it twice", async kind => {
  const input = props({initialMode: kind, loot: {items: [kind === "sell" ? known : unknown], history: []},
    onAppraise: vi.fn(async () => "写入待确认"), onSell: vi.fn(async () => "写入待确认")});
  const view = await start(input);
  await act(async () => fireEvent.click(action(kind === "sell" ? "出售" : "鉴定")));
  expect(screen.getByRole("alert")).toHaveTextContent("写入待确认");
  view.rerender(scene({...input, funds: kind === "sell" ? 57 : 47,
    loot: {items: kind === "sell" ? [] : [known], history: [{id: "confirmed", kind, gold: kind === "sell" ? 8 : 2, item: known}]}}));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(kind === "sell" ? input.onSell : input.onAppraise).toHaveBeenCalledTimes(1);
  if (kind === "appraise") expect(action("收好")).toBeEnabled();
  else expect(document.querySelectorAll(".scene-feedback__notice")).toHaveLength(1);
});

it("keeps unavailable trading and missing loot capabilities disabled", async () => {
  await start(props({available: false, loot: undefined}));
  expect(action("暂不可交易")).toBeDisabled();
  expect(action("增加数量")).toBeDisabled();
  expect(screen.getByRole("tab", {name: "出售"})).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("远征期间无法交易");
});
