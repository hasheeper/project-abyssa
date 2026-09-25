import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CallLog } from "./CallLog";
import type { CallLogEntry } from "../../game-runtime/airp-call-log";
import { serializeCallLog } from "../../game-runtime/airp-call-log";

const download = vi.hoisted(() => vi.fn());
vi.mock("../react", () => ({ downloadJson: download }));
it("exposes the retained raw error and an export without endpoint configuration", () => {
  const entries: CallLogEntry[] = [{ id: "attempt:1", stage: "writing", model: "writer", at: 100, endedAt: 230, requestHash: "abc", status: "failed", usage: { inputTokens: 33500, outputTokens: 35, totalTokens: 33535 }, outcomeUnknown: false, output: "保存的原稿", diagnostics: { version: 1, code: "invalid-output", message: "Missing native performance Plan", httpStatus: 200, requestId: "req-1" } }];
  const { container } = render(<CallLog entries={entries}/>);
  const details = container.querySelector("details")!; details.open = true; fireEvent(details, new Event("toggle"));
  expect(screen.getByText(/writing · failed · writer/)).toBeTruthy();
  expect(screen.getByText(/Missing native performance Plan/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "导出调用日志" }));
  expect(download).toHaveBeenCalledOnce(); const json = JSON.parse(download.mock.calls[0][0]);
  expect(json.calls[0]).toMatchObject({ output: "保存的原稿", durationMs: 130, diagnostics: { requestId: "req-1" } });
});
it("redacts strings before serialization so URLs, newlines and quotes cannot break exported JSON", () => {
  const raw = serializeCallLog([], ['https://private.invalid/v1\n"下一行仍保留"', 'Authorization: Bearer sk-test-secret']);
  expect(() => JSON.parse(raw)).not.toThrow(); expect(raw).not.toContain("private.invalid"); expect(raw).not.toContain("sk-test-secret");
  expect(JSON.parse(raw).warnings[0]).toContain('"下一行仍保留"');
});
