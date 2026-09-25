import { createConnectionVault, type ConnectionVault } from "../game-infrastructure/airp-direct/connection-vault";
import { parseTestConfig } from "../game-infrastructure/airp-direct/test-config";
import type { AiConnectionValues } from "./airp-configuration";

export type AiConnectionStorageState = { initialized: boolean; saved: boolean; busy: boolean; dirty: boolean; error: string | null };
const slots = ["planning", "writing", "updater"] as const;
function serialize(value: AiConnectionValues) {
  const text = JSON.stringify({ version: 1, connection: { baseUrl: value.baseUrl, apiKey: value.commonKey }, models: Object.fromEntries(slots.map(slot => {
    const { baseUrl, ...model } = value.models[slot];
    return [slot, { ...model, ...(value.separate[slot] ? { baseUrl, apiKey: value.keys[slot] } : {}) }];
  })) });
  parseTestConfig(text); // Validate before replacing the saved connection.
  return text;
}
function deserialize(text: string): AiConnectionValues {
  const c = parseTestConfig(text);
  return { baseUrl: c.baseUrl, commonKey: c.apiKey, models: c.models, separate: c.separate, keys: c.keys };
}

/** Auto-restore locally; only an explicit Save writes edited credentials. */
export function createAiConnectionPersistence(read: () => AiConnectionValues, apply: (value: AiConnectionValues | null) => void, notify: () => void,
  vault: ConnectionVault = createConnectionVault()) {
  let state: AiConnectionStorageState = { initialized: false, saved: false, busy: false, dirty: false, error: null };
  let revision = 0, initialization: Promise<void> | undefined;
  const publish = (patch: Partial<AiConnectionStorageState>) => { state = { ...state, ...patch }; notify(); };
  function initialize(): Promise<void> {
    if (initialization) return initialization;
    const currentRevision = revision;
    publish({ busy: true });
    initialization = (async () => {
      try {
        const text = await vault.read();
        publish({ saved: text !== null });
        if (text !== null) {
          const connection = deserialize(text);
          // A slow initial read must never overwrite typing/imports made meanwhile.
          if (revision === currentRevision && !state.dirty) apply(connection);
        } else if (vault.legacyExists()) publish({ error: "旧版配置请重新填写或导入一次，再点击保存。" });
      } catch { publish({ error: "未能恢复本机配置；可重新填写并保存，当前填写仍可临时使用。" }); }
      finally { publish({ initialized: true, busy: false }); }
    })();
    return initialization;
  }
  return {
    getSnapshot: () => state, initialize,
    changed() { revision++; publish({ dirty: true, error: null }); },
    async save() {
      await initialize(); if (state.busy) return false;
      const currentRevision = revision;
      publish({ busy: true, error: null });
      try {
        await vault.write(serialize(read()));
        publish({ saved: true, dirty: currentRevision !== revision }); return true;
      } catch { publish({ error: "未保存。请检查连接格式，并确认使用 HTTPS／本机页面且浏览器允许存储。" }); return false; }
      finally { publish({ busy: false }); }
    },
    async forget() {
      await initialize(); if (state.busy) return false;
      const currentRevision = revision;
      publish({ busy: true, error: null });
      try {
        await vault.remove();
        if (revision === currentRevision) apply(null);
        publish({ saved: false, dirty: currentRevision !== revision }); return true;
      } catch { publish({ error: "未能删除本机配置，请检查浏览器存储权限。" }); return false; }
      finally { publish({ busy: false }); }
    },
  };
}
