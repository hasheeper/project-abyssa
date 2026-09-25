import { bytes, check, object, parseModel, string, type ModelSlot, type Models } from "../../game-application/airp-generation/contracts";
import { completionUrl } from "./provider";
import { assertNoCredentialInPublicConfig } from "../../game-application/airp-generation/credentials";

/** A local user-selected file. Never persist plaintext or log this return value. */
export function parseTestConfig(text: string) {
  check(bytes(text) <= 32768, "测试配置超过32 KiB。");
  let raw: unknown; try { raw = JSON.parse(text); } catch { throw new Error("测试配置不是有效 JSON。"); }
  const r = object(raw); check(r.version === 1, "测试配置版本须为1。");
  const connection = object(r.connection), inputModels = object(r.models);
  const readKey = (value: unknown) => {
    const key = string(value ?? "", "API Key", 8192).trim();
    check(!/[\r\n]/.test(key), "API Key 不能含换行。"); return key;
  };
  const baseUrl = string(connection.baseUrl, "公共 API 地址", 1000).trim(), apiKey = readKey(connection.apiKey);
  if (baseUrl) completionUrl(baseUrl);
  const models = {} as Models, keys = {} as Record<ModelSlot, string>, separate = {} as Record<ModelSlot, boolean>;
  for (const slot of ["planning", "writing", "updater"] as const) {
    const input = object(inputModels[slot]);
    separate[slot] = input.baseUrl !== undefined || input.apiKey !== undefined;
    const address = input.baseUrl === undefined ? baseUrl : string(input.baseUrl, "独立 API 地址", 1000).trim();
    // Never reuse a shared credential silently for an explicitly different endpoint.
    check(input.baseUrl === undefined || address === baseUrl || input.apiKey !== undefined, "独立 API 地址必须同时配置该端点的 apiKey（可以先留空）。");
    if (address) completionUrl(address);
    models[slot] = { ...parseModel({ ...input, baseUrl: address || "https://configuration.invalid", timeoutMs: input.timeoutMs ?? 180000 }), baseUrl: address };
    keys[slot] = input.apiKey === undefined ? apiKey : readKey(input.apiKey);
  }
  assertNoCredentialInPublicConfig(models, [apiKey, ...Object.values(keys)]);
  return { baseUrl, apiKey, models, keys, separate };
}
