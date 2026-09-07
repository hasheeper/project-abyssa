import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameGate, GameProvider } from "./react";
import { ReadGameGate, ReadGameProvider } from "./read-react";
import { clientFixture } from "./testing/helpers";
import { archiveFixture } from "../game-runtime/testing/archive-fixture";

afterEach(cleanup);

it("opens a playable save only once in StrictMode and retains real read failures", async () => {
  const f = await clientFixture({start:false});
  history.replaceState(null,"","/?save=save&epoch=epoch");
  let release!: () => void;
  const ready = new Promise<void>(resolve => {release = resolve;});
  const original = f.runtime.application.open;
  const open = vi.spyOn(f.runtime.application,"open").mockImplementation(async id => {await ready;return original(id);});
  const factory = vi.fn(() => f.runtime);
  render(<StrictMode><GameProvider factory={factory}><GameGate><p>游戏场景</p></GameGate></GameProvider></StrictMode>);
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  expect(factory).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("正在读取档案…")).toBeNull();
  expect(screen.queryByText("游戏场景")).toBeNull();
  await act(async () => {release();});
  await screen.findByText("游戏场景");
  cleanup();
  open.mockResolvedValueOnce({ok:false,error:{code:"storage-unavailable",path:"",message:"test"}});
  render(<GameProvider factory={factory}><GameGate><p>游戏场景</p></GameGate></GameProvider>);
  await screen.findByRole("button",{name:"重试读取"});
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

it("also avoids duplicate initialization in the character reader", async () => {
  const f = await archiveFixture();
  history.replaceState(null,"","/?save=demo&epoch=demo-epoch");
  const open = vi.spyOn(f.reader,"open"), factory = vi.fn(() => f.reader);
  render(<StrictMode><ReadGameProvider factory={factory}><ReadGameGate><p>角色场景</p></ReadGameGate></ReadGameProvider></StrictMode>);
  await screen.findByText("角色场景");
  expect(factory).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
});
