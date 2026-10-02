import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AboutSection } from "./AboutSection";
import { releaseInformation, releaseLabel } from "../../../shared/release/game-release";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows client identity without inventing a save and copies the full build identity", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", {clipboard: {writeText}});
  render(<AboutSection />);
  expect(screen.getByText(releaseLabel())).toBeInTheDocument();
  expect(screen.queryByText("当前存档身份")).toBeNull();
  expect(screen.queryByText(/普通模式无需连接模型/)).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "复制版本信息"}));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已复制"));
  expect(writeText).toHaveBeenCalledWith(releaseInformation());
});

it("handles denied clipboard access while retaining manually selectable details", async () => {
  vi.stubGlobal("navigator", {clipboard: {writeText: vi.fn().mockRejectedValue(new Error("Denied"))}});
  render(<AboutSection />);
  fireEvent.click(screen.getByRole("button", {name: "复制版本信息"}));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("复制失败"));
  expect(screen.getByText("构建详情")).toBeInTheDocument();
});

it("shows only the supplied save protocol, rules and content identity", () => {
  const {container} = render(<AboutSection saveIdentity={{protocolVersion: 4, rulesVersion: 4, contentVersion: 27, catalogDigest: "old-catalog-digest"}} />);
  expect(screen.getByText("当前存档身份")).toBeInTheDocument();
  expect(container.querySelector("dl")).toHaveTextContent("内容27");
  expect(screen.getByText("old-catalog-digest")).toBeInTheDocument();
});
