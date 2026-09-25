import { afterEach, describe, expect, it, vi } from "vitest";
import { completionUrl, createDirectProvider } from "./provider";
import { parseTestConfig } from "./test-config";
import { emptyUsage } from "../../game-application/airp-generation/contracts";
const key = "local-fixture-key-not-real";
const request = { config: { baseUrl: "https://endpoint.invalid/prefix/v1/", model: "model", timeoutMs: 1000 }, messages: [{ role: "user" as const, content: "你好" }] };
const response = (choice: object, usage?: object) => Response.json({ choices: [choice], usage });
afterEach(() => vi.useRealTimers());

describe("direct browser-compatible transport", () => {
  it("classifies upstream context errors without saving echoed credentials or raw text", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { message: `maximum context length exceeded ${key}` } }, { status: 500 }));
    const error = await createDirectProvider(transport)(request, key, new AbortController().signal).catch(e => e);
    expect(error.message).toContain("上下文容量限制"); expect(error.message).not.toContain(key);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["https://a.invalid/v1/", "https://a.invalid/v1/chat/completions"],
    ["https://a.invalid/provider/api", "https://a.invalid/provider/api/chat/completions"],
    ["https://a.invalid/v1/chat/completions", "https://a.invalid/v1/chat/completions"],
  ])("preserves base prefix %s", (input, expected) => expect(completionUrl(input)).toBe(expected));
  it.each(["file:///tmp/api", "https://key@a.invalid", "https://a.invalid?key=x", "https://a.invalid#key", "not a url"])("rejects unsafe address %s", input => expect(() => completionUrl(input)).toThrow());
  it("sends exactly the non-stream text protocol, isolates credentials, and keeps unknown usage null", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ finish_reason: "stop", message: { content: "连接成功", reasoning_content: "not-body" } }));
    const result = await createDirectProvider(transport)(request, key, new AbortController().signal);
    expect(result).toEqual({ text: "连接成功", finishReason: "stop", usage: emptyUsage(), diagnostics: { version: 1, httpStatus: 200, finishReason: "stop" } });
    const [url, init] = transport.mock.calls[0]; expect(url).toBe("https://endpoint.invalid/prefix/v1/chat/completions");
    expect(init).toMatchObject({ mode: "cors", credentials: "omit", redirect: "error", cache: "no-store", headers: { Authorization: `Bearer ${key}` } });
    expect(JSON.parse(init!.body as string)).toEqual({ model: "model", messages: request.messages, stream: false });
    expect(init!.body).not.toContain(key);
  });
  it.each([[401, "authentication"], [403, "authentication"], [429, "rate-limit"], [503, "http-error"]])("classifies HTTP %i without saving upstream text", async (status, code) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(key, { status: Number(status) }));
    await expect(createDirectProvider(transport)(request, key, new AbortController().signal)).rejects.toMatchObject({ code });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { finish_reason: "stop", message: { content: " " } },
    { finish_reason: "tool_calls", message: { tool_calls: [{}] } },
    { finish_reason: "stop", message: { content: "no", refusal: "declined" } },
    { finish_reason: "stop", message: { content: key } },
  ])("rejects unusable content %#", async choice => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(choice));
    await expect(createDirectProvider(transport)(request, key, new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  });
  it("retains known usage on truncated response without accepting incomplete text", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ finish_reason: "length", message: { content: "半句" } }, { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }));
    await expect(createDirectProvider(transport)(request, key, new AbortController().signal)).rejects.toMatchObject({ code: "truncated", usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } });
  });
  it.each([
    [{finish_reason: "stop", message: {content: ""}}, "没有返回正文"],
    [{finish_reason: "tool_calls", message: {tool_calls: [{}]}}, "工具调用"],
    [{finish_reason: "stop", message: {content: []}}, "不是文本"],
    [{message: {content: "正文"}}, "未正常结束"],
    [{finish_reason: "content_filter", message: {}}, "拒绝提供正文"],
  ])("explains the actual invalid completion %#", async (choice, message) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(choice));
    const error = await createDirectProvider(transport)(request, key, new AbortController().signal).catch(e => e);
    expect(error.code).toBe("invalid-response"); expect(error.message).toContain(message);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("does not dispatch an already cancelled request", async () => {
    const transport = vi.fn<typeof fetch>(), abort = new AbortController(); abort.abort();
    await expect(createDirectProvider(transport)(request, key, abort.signal)).rejects.toMatchObject({ code: "cancelled", outcomeUnknown: false });
    expect(transport).not.toHaveBeenCalled();
  });
  it("times out once and reports unknown provider outcome", async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort")))));
    const result = createDirectProvider(transport)(request, key, new AbortController().signal);
    const assertion = expect(result).rejects.toMatchObject({ code: "timeout", outcomeUnknown: true });
    await vi.advanceTimersByTimeAsync(1000); await assertion; expect(transport).toHaveBeenCalledTimes(1);
  });
  it("bounds response bytes", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(2097153)));
    await expect(createDirectProvider(transport)(request, key, new AbortController().signal)).rejects.toMatchObject({ code: "response-size" });
  });
});

describe("local BYOK config", () => {
  const configuration = () => ({ version: 1, connection: { baseUrl: "https://proxy.invalid/v1", apiKey: key }, models: {
    planning: { model: "claude5.1fable", max_tokens: 1200 }, writing: { model: "gemini 3.8falsh", max_tokens: 2400 }, updater: { model: "deepseek-falsh", max_tokens: 4096 },
  } });
  it("preserves exact model IDs and returns credentials separately from model configuration", () => {
    const parsed = parseTestConfig(JSON.stringify(configuration()));
    expect(parsed.models.writing.model).toBe("gemini 3.8falsh"); expect(parsed.keys.updater).toBe(key);
    expect(JSON.stringify(parsed.models)).not.toContain(key); expect(parsed.separate).toEqual({ planning: false, writing: false, updater: false });
  });
  it("requires a key declaration for a separate endpoint instead of leaking the shared key", () => {
    const c = configuration(); Object.assign(c.models.writing, { baseUrl: "https://different.invalid/v1" });
    expect(() => parseTestConfig(JSON.stringify(c))).toThrow(/apiKey/);
    Object.assign(c.models.writing, { apiKey: "" }); expect(parseTestConfig(JSON.stringify(c)).keys.writing).toBe("");
  });
  it("allows the blank template but rejects credentials in non-secret fields", () => {
    const c = configuration(); c.connection = { baseUrl: "", apiKey: "" }; expect(parseTestConfig(JSON.stringify(c)).models.planning.baseUrl).toBe("");
    c.connection.apiKey = key; c.models.planning.model = key; expect(() => parseTestConfig(JSON.stringify(c))).toThrow(/密钥/);
  });
});
