import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenerationWorkbench } from "./GenerationWorkbench";
import { aiConfiguration, createAiConfiguration } from "../../game-runtime/airp-configuration";
import { createGenerationController } from "../../game-runtime/airp-generation";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

afterEach(() => { cleanup(); aiConfiguration.patch(createAiConfiguration().getSnapshot()); vi.restoreAllMocks(); });
it("uses the shared connection at generation time and has no second API form", () => {
  aiConfiguration.patch(createAiConfiguration().getSnapshot());
  const controller = createGenerationController({storage: null}), start = vi.spyOn(controller, "start").mockResolvedValue(undefined);
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  render(<UiMotionProvider preference="reduced"><GenerationWorkbench controller={controller}/></UiMotionProvider>);
  expect(screen.queryByLabelText("公共 API 地址")).toBeNull(); expect(screen.queryByLabelText("公共 API Key")).toBeNull();
  expect(screen.queryByLabelText("导入测试配置")).toBeNull();
  act(() => aiConfiguration.patch({baseUrl: "https://shared.invalid/v1", commonKey: "synthetic-shared-key"}));
  fireEvent.click(screen.getByRole("button", {name: "生成一场对白"}));
  expect(start).toHaveBeenCalledOnce();
  expect(start.mock.calls[0][1].writing.baseUrl).toBe("https://shared.invalid/v1");
  expect(start.mock.calls[0][2]).toEqual({planning: "synthetic-shared-key", writing: "synthetic-shared-key", updater: "synthetic-shared-key"});
  expect(fetch).not.toHaveBeenCalled();
});
