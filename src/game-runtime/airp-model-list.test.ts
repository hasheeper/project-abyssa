import { expect, it, vi } from "vitest";
import { createModelListController } from "./airp-model-list";

const base="https://example.invalid/v1", key="synthetic-list-key";
it("shares one explicit load across matching slots and refreshes only when requested", async () => {
  const fetch=vi.fn(async()=>["gemini-test"]), catalog=createModelListController(fetch);
  expect(fetch).not.toHaveBeenCalled();
  await Promise.all([catalog.load(base,key),catalog.load(`${base}/chat/completions`,key)]);
  expect(fetch).toHaveBeenCalledTimes(1);
  await catalog.load(base,key); expect(fetch).toHaveBeenCalledTimes(1);
  expect(catalog.read(base,key)).toEqual({status:"ready",ids:["gemini-test"],error:null});
  await catalog.load(base,key,true); expect(fetch).toHaveBeenCalledTimes(2);
});
it("isolates different addresses and keys, including a late result from the previous connection", async () => {
  let resolve!: (ids:string[])=>void;
  const fetch=vi.fn(()=>new Promise<string[]>(r=>{resolve=r;})),catalog=createModelListController(fetch);
  const pending=catalog.load(base,key);
  expect(catalog.read(base,"new-key").status).toBe("idle");
  expect(catalog.read("https://other.invalid/v1",key).status).toBe("idle");
  resolve(["old-only-model"]); await pending;
  expect(catalog.read(base,"new-key").ids).toEqual([]);
  expect(catalog.read("https://other.invalid/v1",key).ids).toEqual([]);
  expect(JSON.stringify(catalog.read(base,key))).not.toContain(key);
});
it("cancels requests and ignores late results after the settings page closes", async () => {
  let resolve!: (ids:string[])=>void, signal!:AbortSignal;
  const catalog=createModelListController(async (_base,_key,current)=>{signal=current;return new Promise(r=>{resolve=r;});});
  const pending=catalog.load(base,key); catalog.dispose();
  expect(signal.aborted).toBe(true);
  resolve(["late-model"]); await pending;
  expect(catalog.read(base,key).status).toBe("idle");
});
