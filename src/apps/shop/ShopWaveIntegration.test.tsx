import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { shopWaveFixture } from "../../game-application/testing/shop-wave-fixture";
import { GameSession } from "../../game-client/session";
import { EquipmentEditor } from "../../game-client/EquipmentEditor";
import { SceneTransitionProvider } from "../../shared/transition";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { ShopPage } from "./ShopPage";

let session: GameSession;
vi.mock("../../game-client/react", async original => {
  const actual = await original<typeof import("../../game-client/react")>();
  return {...actual, GameProvider: ({children}: {children: React.ReactNode}) => <actual.GameSessionScope session={session}>{children}</actual.GameSessionScope>};
});
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: () => Promise.resolve()}));
afterEach(() => {cleanup(); session?.dispose(); sessionStorage.clear();});

it("buys equipment through SHOP, previews six real faces and equips a selected native face", async () => {
  const f = await shopWaveFixture(); await f.day(2);
  session = new GameSession(f.runtime, {saveId: f.saveId, epoch: f.read().head.epoch}, sessionStorage);
  await session.refresh(); location.hash = "#/shop";
  const screenRoot = render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopPage/></SceneTransitionProvider></UiMotionProvider>);
  fireEvent.click(await screen.findByRole("tab", {name: /配装/}));
  fireEvent.click(screen.getByRole("option", {name: "嵌铁护腕"}));
  expect(within(screen.getByRole("option", {name: "嵌铁护腕"})).getByLabelText("持有 0，剩余 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: /配装预览/}));
  expect(screen.getByRole("group", {name: "装备后六面预览"}).querySelectorAll("button")).toHaveLength(6);
  expect(f.read().snapshot.campaign.inventory).toEqual([]);
  fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"});
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", {name: "购买"}));
  await waitFor(() => expect(f.read().snapshot.campaign.inventory).toHaveLength(1), {timeout: 10_000});
  expect(f.read().snapshot.campaign.funds.party).toBe(3120);
  await waitFor(() => expect(document.querySelector(".scene-feedback")).toHaveTextContent("嵌铁护腕"));
  expect(screen.queryByRole("option", {name: "嵌铁护腕"})).not.toBeInTheDocument();
  screenRoot.unmount();
  const view = f.runtime.queries.progression(f.read())!, item = view.inventory[0];
  const options = item.preview.find(p => p.ownerId === "kael")!.options;
  render(<EquipmentEditor open onClose={() => {}} ownerId="kael" progression={view} writer={session} state={session.getSnapshot()}/>);
  const target = options.at(-1)!.targetFaceId!;
  const face = options.at(-1)!.faces.find(face => face.id === target)!;
  fireEvent.click(screen.getByRole("button", {name: new RegExp(`第 ${face.slot} 面：`)}));
  fireEvent.click(screen.getByRole("button", {name: "装备嵌铁护腕"}));
  await waitFor(() => expect(f.read().snapshot.campaign.progress.equipment[0]?.targetFaceId).toBe(target), {timeout: 10_000});
  expect(f.read().snapshot.campaign.inventory[0].location).toEqual({kind: "equipped", ownerId: "kael"});
}, 30_000);

it("shows a bought daily item as sold out and gives no gain popup for a refresh", async () => {
  const f = await shopWaveFixture(); await f.day(3);
  const offer = f.read().snapshot.campaign.shop!.offers[0].productId;
  const name = f.catalog.data.shop!.products[offer].name;
  session = new GameSession(f.runtime, {saveId: f.saveId, epoch: f.read().head.epoch}, sessionStorage);
  await session.refresh();
  render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopPage/></SceneTransitionProvider></UiMotionProvider>);
  fireEvent.click(await screen.findByRole("tab", {name: /配装/}));
  fireEvent.click(screen.getByRole("option", {name}));
  fireEvent.click(screen.getByRole("button", {name: "购买"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "售罄"})).toBeDisabled(), {timeout: 10_000});
  expect(screen.getByRole("option", {name})).toBeInTheDocument();
  const count = f.read().snapshot.campaign.inventory.length;
  cleanup(); await f.day(4); await act(() => session.refresh());
  render(<UiMotionProvider preference="reduced"><SceneTransitionProvider><ShopPage/></SceneTransitionProvider></UiMotionProvider>);
  expect(f.read().snapshot.campaign.inventory).toHaveLength(count);
  expect(document.querySelector(".scene-feedback__reward")).toBeNull();
}, 30_000);
