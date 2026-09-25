import { describe, expect, it, vi } from "vitest";
import { createLowProvider } from "./low-provider";
import type { LowRequest } from "../../game-application/airp-low/contracts";

const key = "fixture-low-key-not-real";
const config = { baseUrl: "https://model.invalid/v1", model: "writer", timeoutMs: 1000 };
const request: LowRequest = { stage: "writing", requestHash: "fixture", messages: [{ role: "user", content: "原文" }],
  sampling: { stream: true, temperature: 1, top_p: 1, max_tokens: 65535, frequency_penalty: 0, presence_penalty: 0, reasoning_effort: "low", n: 1 } };
const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 };
const expectedUsage = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
const sse = (content: string, finish: string | null, extra: object = {}) => new Response([
  { choices: [{ delta: { content, reasoning_content: "private-reasoning-must-not-be-read", ...extra }, finish_reason: null }] },
  { choices: [{ delta: {}, finish_reason: finish }], usage },
].map(v => `data: ${JSON.stringify(v)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });

describe("native Low transport terminal states", () => {
  it.each(["length", null])("v5 keeps nonempty imperfect completion for postprocessing without hiding finish=%s", async finish => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(sse("艾洛拉：先等等！", finish));
    const result = await createLowProvider(transport)({ ...request, acceptPartialDraft: true }, config, key, new AbortController().signal);
    expect(result.text).toBe("艾洛拉：先等等！"); expect(result.finishReason).toBe(finish ?? "unknown");
    expect(result.diagnostics?.finishReason).toBe(finish ?? "missing"); expect(result.diagnostics?.message).toContain("后处理");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("preserves frozen sampling and reads only public text", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(sse("完整正文", "stop"));
    const result = await createLowProvider(transport)(request, config, key, new AbortController().signal);
    expect(result).toEqual({ text: "完整正文", usage: expectedUsage, finishReason: "stop", diagnostics: { version: 1, httpStatus: 200, finishReason: "stop" } });
    expect(JSON.parse(transport.mock.calls[0][1]!.body as string)).toEqual({ model: config.model, messages: request.messages, ...request.sampling });
    expect(transport.mock.calls[0][1]).toMatchObject({ redirect: "error", credentials: "omit" });
  });
  it.each([
    ["content_filter", {}, "content-filter"],
    ["stop", { refusal: "declined" }, "content-filter"],
    ["length", {}, "truncated"],
    [null, {}, "invalid-response"],
    ["stop", { tool_calls: [{}] }, "invalid-response"],
  ])("classifies %s without auto-retrying or accepting complete-looking tags", async (finish, extra, code) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(sse("<Interleaving>看似完整</Interleaving>", finish as string | null, extra as object));
    const error = await createLowProvider(transport)(request, config, key, new AbortController().signal).catch(e => e);
    expect(error).toMatchObject({ code, outcomeUnknown: false, usage: expectedUsage });
    expect(error.message).not.toContain("看似完整"); expect(error.message).not.toContain(key);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("rejects credential echo before classifying a filtered response", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(sse(key, "content_filter"));
    await expect(createLowProvider(transport)(request, config, key, new AbortController().signal)).rejects.toMatchObject({ code: "credential-in-output", usage: expectedUsage });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("classifies a non-stream fallback response identically", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: "正文" }, finish_reason: "content_filter" }], usage }));
    await expect(createLowProvider(transport)(request, config, key, new AbortController().signal)).rejects.toMatchObject({ code: "content-filter", usage: expectedUsage });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("does not dispatch a request cancelled before sending", async () => {
    const abort = new AbortController(); abort.abort(); const transport = vi.fn<typeof fetch>();
    await expect(createLowProvider(transport)(request, config, key, abort.signal)).rejects.toMatchObject({ code: "cancelled", outcomeUnknown: false });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    ["", "stop", {}, "没有返回正文"],
    ["正文", null, {}, "未正常结束"],
    ["", "tool_calls", {tool_calls: [{}]}, "工具调用"],
    ["", "stop", {content: [{type: "text", text: "非字符串"}]}, "不是文本"],
  ])("explains an unusable response without repeating the call %#", async (text, finish, extra, message) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(sse(text as string, finish as string | null, extra as object));
    const error = await createLowProvider(transport)(request, config, key, new AbortController().signal).catch(e => e);
    expect(error).toMatchObject({code: "invalid-response", usage: expectedUsage});
    expect(error.message).toContain(message);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("distinguishes malformed streaming data from a network failure", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("data: {broken}\n\n", {headers: {"content-type": "text/event-stream"}}));
    await expect(createLowProvider(transport)(request, config, key, new AbortController().signal)).rejects.toMatchObject({code: "invalid-response", message: "接口响应格式不正确，请查看调用记录并检查端点。"});
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
