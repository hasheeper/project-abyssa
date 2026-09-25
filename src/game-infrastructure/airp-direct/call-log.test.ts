import { expect, it, vi } from "vitest";
import { createDirectProvider } from "./provider";
import { createLowProvider } from "./low-provider";
import { callDiagnostics } from "../../game-application/airp-generation/diagnostics";
import type { LowRequest } from "../../game-application/airp-low/contracts";

const key = "test-private-key-123", config = { baseUrl: "https://private-proxy.invalid/v1", model: "writer", timeoutMs: 1000 };
const request: LowRequest = { stage: "writing", requestHash: "test", messages: [{ role: "user", content: "测试" }], sampling: { stream: true, temperature: 1, top_p: 1, max_tokens: 65535, frequency_penalty: 0, presence_penalty: 0, reasoning_effort: "low", n: 1 } };

it.each(["direct", "stream"])("retains the real proxy exception, HTTP and request id with credentials redacted: %s", async mode => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { message: `Proxy error: 'NoneType' object has no attribute 'get'; Authorization: Bearer ${key}; ${config.baseUrl}` } }, { status: 500, headers: { "x-request-id": "req-proxy-failed" } }));
  const error = await (mode === "direct" ? createDirectProvider(transport)({ config, messages: request.messages }, key, new AbortController().signal) : createLowProvider(transport)(request, config, key, new AbortController().signal)).catch(e => e);
  const log = callDiagnostics(error, config.model, [key]);
  expect(log).toMatchObject({ version: 1, httpStatus: 500, requestId: "req-proxy-failed", model: "writer", code: "http-error" });
  expect(log.responseBody).toContain("'NoneType' object has no attribute 'get'");
  expect(JSON.stringify(log)).not.toContain(key); expect(JSON.stringify(log)).not.toContain(config.baseUrl);
  expect(transport).toHaveBeenCalledTimes(1);
});
it.each(["direct", "stream"])("redacts the transmitted key even when the entered key has surrounding spaces: %s", async mode => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({error: {message: `opaque echo ${key}`}}, {status: 500, headers: {"x-request-id": `trace-${key}`}}));
  const entered = `  ${key}  `;
  const error = await (mode === "direct" ? createDirectProvider(transport)({config, messages: request.messages}, entered, new AbortController().signal)
    : createLowProvider(transport)(request, config, entered, new AbortController().signal)).catch(e => e);
  expect(error.diagnostics?.responseBody).toContain("opaque echo");
  expect(JSON.stringify(error.diagnostics)).not.toContain(key);
  expect(transport.mock.calls[0][1]?.headers).toMatchObject({Authorization: `Bearer ${key}`});
});
it("retains a stream-level proxy error even when HTTP was 200", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('data: {"error":{"message":"channel failed"}}\n\n', { headers: { "content-type": "text/event-stream" } }));
  const e = await createLowProvider(transport)(request, config, key, new AbortController().signal).catch(e => e);
  expect(e).toMatchObject({ code: "upstream-error", diagnostics: { httpStatus: 200, responseBody: '{"message":"channel failed"}' } });
});
it("bounds large error bodies but keeps their useful prefix", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("Proxy broke. " + "x".repeat(100000), { status: 502 }));
  const e = await createDirectProvider(transport)({ config, messages: request.messages }, key, new AbortController().signal).catch(e => e);
  expect(e.diagnostics.responseBody).toContain("Proxy broke."); expect(e.diagnostics.responseBody.length).toBeLessThan(17000);
});
