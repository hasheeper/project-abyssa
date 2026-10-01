import type { AnyGameRecord } from "../game-application";
import { freezeData } from "../game-core/contracts";
import type { CatalogRegistry } from "./catalogs";
import type { MemoryJournalData } from "./memory-journal-types";
import { createJournalBuilder, journalFacts, type JournalRecord } from "./memory-journal/common";
import { authoredJournal, skippedOpeningJournal, tutorialJournal } from "./memory-journal/authored";
import { directorJournal, expeditionJournal, poolJournal } from "./memory-journal/generated";
import { shopJournal } from "./memory-journal/shop";

export function createMemoryJournalQuery(registry: CatalogRegistry) {
  const cache = new WeakMap<AnyGameRecord, MemoryJournalData>();
  return (raw: AnyGameRecord): MemoryJournalData => {
    let record: AnyGameRecord;
    try { record = registry.read(raw); }
    catch { return { status: "unavailable", reason: "source-unavailable", message: "这份存档的内容版本或阅读记录暂时无法核对。" }; }
    const cached = cache.get(record);
    if (cached) return cached;
    if (record.schemaVersion !== 4) return { status: "unavailable", reason: "unsupported-version", message: "这份早期存档没有可还原的剧情阅读记录。" };
    const records: JournalRecord[] = [];
    let current: AnyGameRecord | undefined = record;
    // Copies/upgrades continue one chronology. A cycle begins a new time domain.
    while (current?.schemaVersion === 4) {
      const catalog = registry.resolve(current.schemaVersion, current.contentRef);
      if (catalog.version !== 4) break;
      records.unshift({ record: current, catalog: catalog.catalog });
      current = current.originRef?.kind === "cycle" ? undefined : current.originRef?.source;
    }
    const root = records[0].record;
    const out = createJournalBuilder(JSON.stringify([root.head.saveId, root.head.epoch]));
    if (current) out.issue("继承记录", "更早版本的经历没有完整正文；本页展示能够核对的记录。");
    const facts = journalFacts(records);
    for (const [source, project] of [
      ["固定剧情", () => authoredJournal(facts, out)],
      ["开局记忆", () => skippedOpeningJournal(facts, out)],
      ["退潮岩窟", () => tutorialJournal(facts, out)],
      ["商店记忆", () => shopJournal(facts, out)],
      ["洋馆对话", () => directorJournal(records, facts, out)],
      ["早期洋馆对话", () => poolJournal(records, facts, out)],
      ["远征对话", () => expeditionJournal(records, facts, out)],
    ] as const) {
      try { project(); } catch { out.issue(source, "这部分经历暂时无法读取，其余记录仍可浏览。"); }
    }
    const result: MemoryJournalData = freezeData({ status: "ready", entries: out.entries(), ...(out.issues.length ? { issues: out.issues } : {}) });
    cache.set(record, result);
    return result;
  };
}
