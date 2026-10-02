import { afterEach, expect, it, vi } from "vitest";
import { fetchModelIds, modelsUrl } from "./model-list";

const key = "synthetic-model-list-key";
afterEach(() => vi.useRealTimers());
it.each([
  ["https://example.invalid/prefix/v1/", "https://example.invalid/prefix/v1/models"],
  ["https://example.invalid/prefix/v1/chat/completions", "https://example.invalid/prefix/v1/models"],
  ["https://example.invalid/v1beta/openai", "https://example.invalid/v1beta/openai/models"],
])("derives discovery from the existing completion base %s", (base, expected) => expect(modelsUrl(base)).toBe(expected));
it("requests only a model list, deduplicates exact IDs and excludes unusable or credential-bearing entries", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:[{id:"gemini/Test"},{id:"gpt/test"},{id:"gemini/Test"},{id:key},{id:"\n"},{id:"x".repeat(201)},{name:"not-an-id"}]}));
  expect(await fetchModelIds("https://example.invalid/v1", key, new AbortController().signal, transport)).toEqual(["gemini/Test", "gpt/test"]);
  expect(transport).toHaveBeenCalledExactlyOnceWith("https://example.invalid/v1/models", expect.objectContaining({method:"GET",credentials:"omit",redirect:"error",cache:"no-store",headers:{Accept:"application/json",Authorization:`Bearer ${key}`}}));
  expect(transport.mock.calls[0][1]).not.toHaveProperty("body");
});
it.each([401, 403, 404, 405, 429, 500])("reports HTTP %i without displaying upstream secrets", async status => {
  const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(key,{status}));
  const error=await fetchModelIds("https://example.invalid/v1",key,new AbortController().signal,transport).catch(error=>error);
  expect(error).toBeInstanceOf(Error); expect(error.message).not.toContain(key);
  expect(transport).toHaveBeenCalledTimes(1);
});
it("accepts empty data but rejects incompatible or non-JSON replies", async () => {
  expect(await fetchModelIds("https://example.invalid/v1",key,new AbortController().signal,async()=>Response.json({data:[]}))).toEqual([]);
  for(const response of [Response.json({models:["test"]}),new Response("<html>not a list</html>")])
    await expect(fetchModelIds("https://example.invalid/v1",key,new AbortController().signal,async()=>response)).rejects.toThrow("模型列表");
});
it("rejects invalid addresses, missing keys and cancelled requests before dispatch", async () => {
  const transport=vi.fn<typeof fetch>(), signal=new AbortController(); signal.abort();
  await expect(fetchModelIds("https://example.invalid?key=bad",key,signal.signal,transport)).rejects.toThrow();
  await expect(fetchModelIds("https://example.invalid/v1","",signal.signal,transport)).rejects.toThrow("API Key");
  await expect(fetchModelIds("https://example.invalid/v1",key,signal.signal,transport)).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
it("times out a list request without retrying or echoing transport errors", async () => {
  vi.useFakeTimers();
  const transport=vi.fn<typeof fetch>().mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(Error(key)))));
  const result=fetchModelIds("https://example.invalid/v1",key,new AbortController().signal,transport);
  const assertion=expect(result).rejects.toThrow("超时");
  await vi.advanceTimersByTimeAsync(15000); await assertion;
  expect(transport).toHaveBeenCalledTimes(1);
});
