import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MansionPsdManifest, MansionRegionFile } from "../../shared/domain/mansion/regions";
import { MansionRegionEditor } from "./MansionRegionEditor";

const STORAGE_KEY = "abyssa:mansion-map-regions:v2:floor-aligned-v1";
const manifest: MansionPsdManifest = {
  version: 1,
  source: "mansion.psd",
  width: 1000,
  height: 500,
  layers: [{
    id: "base",
    name: "Base",
    src: "base.png",
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
    visible: true,
    opacity: 1,
    order: 0
  }]
};

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, regions: [], rectangles: [] }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(manifest)
  }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    right: 1000,
    bottom: 600,
    left: 0,
    width: 1000,
    height: 600,
    toJSON: () => ({})
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn()
  });
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("MansionRegionEditor", () => {
  it("draws a normalized rectangle and persists it", async () => {
    const { container } = render(<MansionRegionEditor />);
    await screen.findByText("mansion.psd · 1000 × 500");

    fireEvent.click(screen.getByRole("button", { name: "+ 新建矩形" }));
    const viewport = container.querySelector<HTMLElement>(".mansion-editor__viewport")!;
    fireEvent.pointerDown(viewport, { button: 0, pointerId: 7, clientX: 119.2, clientY: 109.6 });
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 500, clientY: 300 });
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 500, clientY: 300 });

    expect(await screen.findByText(/已保存矩形：未命名矩形 1/)).toBeInTheDocument();
    expect(screen.getByText("rectangle-1 · 矩形")).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as MansionRegionFile;
    expect(saved.rectangles).toHaveLength(1);
    expect(saved.rectangles[0].rect).toEqual({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 });
  });

  it("imports a compatible snapshot and copies the resulting JSON", async () => {
    render(<MansionRegionEditor />);
    await screen.findByText("mansion.psd · 1000 × 500");
    const imported: MansionRegionFile = {
      version: 2,
      canvas: { width: 1000, height: 500 },
      rectangles: [{
        id: "hall",
        label: "Great Hall",
        kind: "room",
        rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      }],
      regions: []
    };
    const file = new File([JSON.stringify(imported)], "regions.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => JSON.stringify(imported) });
    const input = screen.getByLabelText("导入 JSON");

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("hall · 矩形")).toBeInTheDocument();
    expect(screen.getByText(/已导入 1 个矩形、0 个多边形/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制 JSON" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(JSON.parse(writeText.mock.calls[0][0])).toMatchObject({
      version: 2,
      rectangles: [{ id: "hall", label: "Great Hall" }]
    });
  });
});
