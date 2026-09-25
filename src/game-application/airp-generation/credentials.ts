import { check } from "./contracts";

/** Public model configuration can be frozen into saves; credentials cannot. */
export function assertNoCredentialInPublicConfig(publicConfig: unknown, keys: Iterable<string>): void {
  const publicText = JSON.stringify(publicConfig);
  check([...keys].every(value => !value.trim() || !publicText.includes(value.trim())), "密钥不能放在 API 地址、模型名或非敏感配置中。");
}
