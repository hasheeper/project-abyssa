import { bytes, check, emptyUsage, hash, LIMITS, parseModel, type ProbeRecord, type RunRecord } from "../../game-application/airp-generation/contracts";
import { restoreRun } from "../../game-application/airp-generation/run";
export const RUN_CACHE_KEY = "abyssa-airp-preview-v2";
export const BUDGET_KEY = "abyssa-airp-call-budget-v1";
export const PROBE_CACHE_KEY = "abyssa-airp-probes-v1";
export type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createPreviewCache(storage: PreviewStorage | null) {
  return {
    probes(): ProbeRecord[] {
      try {
        const text = storage?.getItem(PROBE_CACHE_KEY); if (!text) return [];
        check(bytes(text) <= LIMITS.cacheBytes, "连接记录过大。"); const records = JSON.parse(text);
        check(Array.isArray(records) && records.length <= 100, "连接记录无效。");
        return records.map((p: ProbeRecord) => {
          const config = parseModel(p.config);
          check(p && ["planning", "writing", "updater"].includes(p.slot) && ["succeeded", "failed", "interrupted"].includes(p.status), "连接记录无效。");
          check(typeof p.id === "string" && p.configuration === hash(config) && typeof p.elapsedMs === "number" && Number.isFinite(p.elapsedMs) && p.elapsedMs >= 0, "连接记录无效。");
          check((p.text === null || typeof p.text === "string") && (p.error === null || typeof p.error === "string") && typeof p.outcomeUnknown === "boolean", "连接记录无效。");
          const usage = emptyUsage();
          for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) { const count = p.usage?.[key]; check(count === null || Number.isSafeInteger(count) && count! >= 0, "连接用量无效。"); usage[key] = count; }
          return { id: p.id, slot: p.slot, configuration: p.configuration, config, status: p.status, text: p.text, error: p.error, outcomeUnknown: p.outcomeUnknown, elapsedMs: p.elapsedMs, usage };
        });
      } catch { return []; }
    },
    saveProbes(records: ProbeRecord[]) { try { const text = JSON.stringify(records); if (!storage || bytes(text) > LIMITS.cacheBytes) return false; storage.setItem(PROBE_CACHE_KEY, text); return true; } catch { return false; } },
    read(): { run: RunRecord | null; error: string | null } {
      try { const value = storage?.getItem(RUN_CACHE_KEY); return { run: value ? restoreRun(value) : null, error: storage ? null : "试读缓存不可用。" }; }
      catch { return { run: null, error: "试读缓存不可读取或已损坏，原数据未删除；可以清理后重试。" }; }
    },
    save(run: RunRecord | null): boolean {
      if (!storage) return false;
      try { if (!run) storage.removeItem(RUN_CACHE_KEY); else { const text = JSON.stringify(run); if (bytes(text) > LIMITS.cacheBytes) return false; storage.setItem(RUN_CACHE_KEY, text); } return true; }
      catch { return false; }
    },
    budget(): { calls: number; limit: number } {
      try { const raw = storage?.getItem(BUDGET_KEY); if (!raw) return { calls: 0, limit: 12 }; const b = JSON.parse(raw);
        if (!Number.isSafeInteger(b.calls) || b.calls < 0 || !Number.isSafeInteger(b.limit) || b.limit < 1 || b.limit > 100) throw Error(); return b;
      } catch { return { calls: 12, limit: 12 }; } // Unreadable accounting must not restore free calls.
    },
    saveBudget(value: { calls: number; limit: number }) { try { storage?.setItem(BUDGET_KEY, JSON.stringify(value)); return !!storage; } catch { return false; } },
  };
}
