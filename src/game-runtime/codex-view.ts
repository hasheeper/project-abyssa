import type { AnyGameRecord, D5GameRecord, DemoGameRecord } from "../game-application";
import { d5EnemyEvidence } from "../game-application/versions/d5-validate";
import { demoEnemyEvidence } from "../game-application/versions/enemy-evidence";
import { freezeData } from "../game-core/contracts";
import { codexDefinitions, codexEntryByEnemy, codexSceneNames } from "../content/presentation/codex-definitions";
import type { CatalogRegistry } from "./catalogs";
import type { CodexData, CodexEntryData, CodexSource } from "./codex-types";

const behaviors: Record<string, string> = { attack: "攻击", charge: "蓄力攻击", seal: "封锁命数骰", repair: "修复", butler: "封锁 / 攻击", heiress: "召唤候席客", idle: "待机" };

export function createCodexQuery(registry: CatalogRegistry) {
  const cache = new WeakMap<AnyGameRecord, CodexData>();
  return (raw: AnyGameRecord): CodexData => {
    let record: AnyGameRecord;
    try { record = registry.read(raw); }
    catch { return { status: "unavailable", message: "这份存档的内容版本或战斗记录暂时无法核对。" }; }
    const cached = cache.get(record);
    if (cached) return cached;
    if (record.schemaVersion === 1) return { status: "unavailable", message: "这份早期存档没有可还原的图鉴收录记录。" };
    const owners: (D5GameRecord | DemoGameRecord)[] = [];
    let current: D5GameRecord | DemoGameRecord | undefined = record;
    while (current) {
      owners.unshift(registry.read(current) as D5GameRecord | DemoGameRecord);
      current = current.schemaVersion === 4 && current.originRef?.kind !== "cycle" ? current.originRef?.source : undefined;
    }
    const retracted = new Set(owners.flatMap(owner => owner.retractedFactIds));
    const progress = new Map<string, { firstEncounter?: CodexSource; firstDefeat?: CodexSource }>();
    const currentCatalog = registry.resolve(record.schemaVersion, record.contentRef);
    if (currentCatalog.version === 1) throw Error("Expected creature Catalog");
    const catalog = currentCatalog.catalog.data;
    const d5 = currentCatalog.version === 4 ? currentCatalog.catalog.data : null;
    const playable = new Set<string>();
    const routeIds = new Set([...Object.keys(d5?.expeditions ?? catalog.routes), ...(d5?.tutorial ? [d5.tutorial.routeId] : []),
      ...(catalog.manor ? [catalog.manor.firstClearRouteId, catalog.manor.maintenanceRouteId] : [])]);
    for (const routeId of routeIds) for (const roomId of catalog.routes[routeId]?.layers.flat() ?? []) {
      const room = catalog.journey!.rooms[roomId];
      if (room?.kind === "battle") catalog.encounters[room.encounterId].enemyIds.forEach(id => playable.add(id));
    }
    if (d5) catalog.encounters[d5.progression.chapter.encounterId].enemyIds.forEach(id => playable.add(id));
    for (const owner of owners) {
      const registered = registry.resolve(owner.schemaVersion, owner.contentRef);
      if (registered.version === 1) continue;
      const facts = new Map(owner.facts.map(f => [f.id, f]));
      const evidenceList = registered.version === 4 ? d5EnemyEvidence(owner as D5GameRecord) : demoEnemyEvidence(registered.catalog, owner as DemoGameRecord);
      for (const evidence of evidenceList) {
        if (retracted.has(evidence.factId)) continue;
        const id = codexEntryByEnemy.get(evidence.definitionId), fact = facts.get(evidence.factId);
        if (!id || !fact) continue;
        const room = evidence.roomId ? registered.catalog.data.journey!.rooms[evidence.roomId] : null;
        const location = room && codexSceneNames[room.sceneId] || (registered.version === 4 && registered.catalog.data.expeditions?.[evidence.routeId]?.name)
          || (evidence.routeId.startsWith("memory.") ? "旧日战斗" : "远征途中");
        const source: CodexSource = { ...fact.source, factId: fact.id, definitionId: evidence.definitionId, encounterId: evidence.encounterId,
          contentVersion: owner.contentRef.contentVersion, worldTime: fact.worldTime, location };
        const item = progress.get(id) ?? {};
        item.firstEncounter ??= source;
        if (evidence.stage === "defeated") item.firstDefeat ??= source;
        progress.set(id, item);
      }
    }
    const entries: CodexEntryData[] = codexDefinitions.filter(entry => entry.enemyIds.some(id => playable.has(id)) || progress.has(entry.id)).map(entry => {
      const found = progress.get(entry.id);
      const stage = found?.firstDefeat ? "defeated" : found?.firstEncounter ? "seen" : "unknown";
      if (stage === "unknown") return { id: entry.id, number: entry.number, stage, name: "未收录", englishName: "", family: "未收录",
        description: "尚未遇见这个对象。", tags: [], facts: [], dropIds: [], dropsStatus: "locked" };
      const location = found!.firstEncounter!.location;
      const regions = new Set<string>();
      for (const routeId of routeIds) for (const roomId of catalog.routes[routeId]?.layers.flat() ?? []) {
        const room = catalog.journey!.rooms[roomId];
        if (room?.kind === "battle" && catalog.encounters[room.encounterId].enemyIds.some(id => entry.enemyIds.includes(id))) {
          const name = codexSceneNames[room.sceneId];
          if (name) regions.add(name);
        }
      }
      const action = [...new Set(entry.enemyIds.filter(id => playable.has(id)).map(id => catalog.enemies[id]).filter(Boolean).map(enemy => behaviors[enemy.behavior] ?? enemy.behavior))].join(" / ");
      const table = stage === "defeated" && entry.lootTableId ? d5?.loot?.dropTables?.tables?.[entry.lootTableId] : undefined;
      const dropIds = [...new Set(table?.entries.flatMap(drop => drop.definitionId ? [drop.definitionId] : []) ?? [])];
      const facts = [{ label: "形态与特征", value: entry.traits }, { label: stage === "defeated" ? "出没区域" : "初遇地点", value: stage === "defeated" && regions.size ? [...regions].join(" / ") : location }];
      if (stage === "defeated" && action) facts.push({ label: "行动方式", value: action });
      facts.push({ label: "图鉴分类", value: entry.family });
      return { id: entry.id, number: entry.number, stage, name: entry.name, englishName: entry.englishName, family: entry.family,
        description: entry.description, tags: [entry.family, location], facts,
        ...(stage === "defeated" ? { note: { text: `第${found!.firstEncounter!.worldTime.day}天在${location}首次遇见。第${found!.firstDefeat!.worldTime.day}天完成首次击败。`, source: "遭遇记录" } } : {}),
        dropIds, dropsStatus: stage !== "defeated" ? "locked" : table ? dropIds.length ? "recorded" : "none" : "unavailable",
        firstEncounter: found!.firstEncounter, ...(found!.firstDefeat ? { firstDefeat: found!.firstDefeat } : {}) };
    });
    const data: CodexData = freezeData({ status: "ready", entries, encountered: entries.filter(e => e.stage !== "unknown").length, defeated: entries.filter(e => e.stage === "defeated").length });
    cache.set(record, data);
    return data;
  };
}
