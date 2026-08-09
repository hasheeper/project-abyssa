import selectionData from "./selection.json";

export type ItemIconCategory = "equipment" | "supplies" | "food" | "materials" | "tools" | "furniture" | "treasures";
export type ItemIconReviewStatus = "verified" | "needs-review" | "rejected";
export type ItemIconState = "normal" | "broken" | "damaged" | "rusted" | "cursed" | "poisoned" | "burning" | "frozen" | "locked" | "sealed" | "empty" | "unknown";

type SelectionEntry = {
  id: string;
  source: string;
  author: string;
  category: ItemIconCategory;
  zh: string[];
  en: string[];
  excludeZh?: string[];
  excludeEn?: string[];
  stateBaseZh?: string[];
  stateBaseEn?: string[];
  priority: number;
  quality?: number;
  variantGroup?: string;
  review: ItemIconReviewStatus;
  states: ItemIconState[];
};

export type ItemIconQuery = {
  name: string;
  category?: string;
  quality?: number;
};

export type ItemIconCatalogEntry = SelectionEntry & {
  assetUrl: string;
  sourceUrl: string;
  pageUrl: string;
  license: string;
};

export type ItemIconMatch = {
  entry: ItemIconCatalogEntry;
  assetUrl: string;
  matchedKeyword: string | null;
  detectedStates: ItemIconState[];
  matchKind: "keyword" | "state" | "fallback";
  matchedField: "name" | "category" | null;
  score: number;
  reviewStatus: ItemIconReviewStatus;
};

const svgModules = import.meta.glob("./game-icons/*.svg", {
  eager: true,
  query: "?url&no-inline",
  import: "default"
}) as Record<string, string>;

const sourceCommit = "82d948812bfe3f269ef8f731dcdb07b08160edc4";

export const itemIconCatalog: ItemIconCatalogEntry[] = (selectionData as SelectionEntry[]).map((selection) => {
  const assetUrl = svgModules[`./game-icons/${selection.id}.svg`];
  if (!assetUrl) throw new Error(`Incomplete item icon catalog entry: ${selection.id}`);
  return {
    ...selection,
    assetUrl,
    sourceUrl: `https://github.com/game-icons/icons/blob/${sourceCommit}/${selection.source}`,
    pageUrl: `https://game-icons.net/1x1/${selection.source.replace(/\.svg$/, ".html")}`,
    license: "CC BY 3.0"
  };
});

const catalogById = new Map(itemIconCatalog.map((entry) => [entry.id, entry]));
function requireCatalogEntry(id: string): ItemIconCatalogEntry {
  const entry = catalogById.get(id);
  if (!entry) throw new Error(`The item icon catalog requires ${id}`);
  return entry;
}
const fallbackEntry = requireCatalogEntry("swap-bag");

const stateKeywords: Record<Exclude<ItemIconState, "normal" | "unknown">, string[]> = {
  broken: ["破损", "破碎", "碎裂", "断裂", "折断", "损毁", "broken", "shattered", "snapped"],
  damaged: ["损坏", "受损", "裂纹", "缺口", "划痕", "damaged", "cracked", "chipped", "scratched"],
  rusted: ["生锈", "锈蚀", "腐锈", "rusted", "rusty", "corroded"],
  cursed: ["诅咒", "邪化", "不祥", "宝箱怪", "cursed", "hexed", "mimic"],
  poisoned: ["中毒", "毒药", "毒剂", "剧毒", "poisoned", "poison", "toxic"],
  burning: ["燃烧", "着火", "火焰", "灼烧", "burning", "flaming", "fire"],
  frozen: ["冻结", "冰冻", "寒冰", "冰霜", "frozen", "icy", "frost"],
  locked: ["上锁", "锁住", "封锁", "locked", "padlocked"],
  sealed: ["密封", "封缄", "封印", "未开封", "sealed", "unopened"],
  empty: ["空瓶", "空的", "耗尽", "empty", "depleted"]
};

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function detectStates(text: string): ItemIconState[] {
  const normalized = normalize(text);
  const detected = (Object.entries(stateKeywords) as Array<[Exclude<ItemIconState, "normal" | "unknown">, string[]]>)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalize(keyword))))
    .map(([state]) => state);
  return detected.length ? detected : ["normal"];
}

function isExcluded(entry: SelectionEntry, normalizedText: string) {
  return [...(entry.excludeZh ?? []), ...(entry.excludeEn ?? [])]
    .some((keyword) => normalizedText.includes(normalize(keyword)));
}

// Chinese titles normally read as "modifier + core noun". A one-character
// noun is useful for a genuine item such as "神话之剑", but must not turn a
// component like "剑油", "床单", or "护牙粉" into the icon for its embedded root.
// The compound check applies the same protection to terms such as "台灯油".
const trailingItemNouns = ["油", "粉", "液", "剂", "膏", "水", "酒", "饭", "盒", "套", "壳", "柄", "片", "单", "布", "绳", "钉", "芯", "罩", "座", "架", "杯", "碗", "盘", "桶", "瓶"];

function isUsableKeywordPosition(keyword: string, haystack: string, matchIndex: number) {
  if (!/\p{Script=Han}/u.test(keyword)) return true;
  const normalizedKeyword = normalize(keyword);
  const suffix = haystack.slice(matchIndex + normalizedKeyword.length);
  if (normalizedKeyword.length === 1) return suffix.length === 0;
  return !trailingItemNouns.some((noun) => suffix.startsWith(normalize(noun)));
}

export function resolveItemIcon(input: string | ItemIconQuery): ItemIconMatch {
  const query = typeof input === "string" ? { name: input } : input;
  const normalizedName = normalize(query.name);
  const normalizedCategory = normalize(query.category ?? "");
  const normalizedText = `${normalizedName}${normalizedCategory}`;
  const quality = query.quality == null ? undefined : Math.max(1, Math.min(5, query.quality));
  const detectedStates = detectStates(`${query.name} ${query.category ?? ""}`);
  const detectedStateSet = new Set(detectedStates);
  let best: { entry: ItemIconCatalogEntry; keyword: string; score: number; qualityDistance: number; kind: "keyword" | "state"; field: "name" | "category" } | undefined;

  for (const entry of itemIconCatalog) {
    if (entry.review !== "verified" || entry.id === fallbackEntry.id || isExcluded(entry, normalizedText)) continue;
    const hasMatchingState = entry.states.some((state) => state !== "normal" && detectedStateSet.has(state));
    const candidates = [
      ...entry.zh.map((keyword) => ({ keyword, kind: "keyword" as const })),
      ...entry.en.map((keyword) => ({ keyword, kind: "keyword" as const })),
      ...(hasMatchingState ? [...(entry.stateBaseZh ?? []), ...(entry.stateBaseEn ?? [])].map((keyword) => ({ keyword, kind: "state" as const })) : [])
    ];

    for (const candidate of candidates) {
      const normalizedKeyword = normalize(candidate.keyword);
      if (!normalizedKeyword) continue;
      const nameIndex = normalizedName.lastIndexOf(normalizedKeyword);
      const categoryIndex = normalizedCategory.lastIndexOf(normalizedKeyword);
      const field = nameIndex >= 0 ? "name" : categoryIndex >= 0 ? "category" : undefined;
      if (!field) continue;

      const haystack = field === "name" ? normalizedName : normalizedCategory;
      const matchIndex = field === "name" ? nameIndex : categoryIndex;
      if (!isUsableKeywordPosition(candidate.keyword, haystack, matchIndex)) continue;
      const distanceFromEnd = haystack.length - (matchIndex + normalizedKeyword.length);
      const fieldBonus = field === "name" ? 260 : 0;
      const headNounBonus = field === "name" ? Math.max(0, 180 - distanceFromEnd * 45) : 0;
      const exactBonus = haystack === normalizedKeyword ? 40 : 0;
      const stateBonus = hasMatchingState ? 90 : 0;
      const stateBaseBonus = candidate.kind === "state" ? 180 : 0;
      const qualityDistance = quality != null && entry.quality != null ? Math.abs(quality - entry.quality) : Number.POSITIVE_INFINITY;
      const score = entry.priority + normalizedKeyword.length * 8 + fieldBonus + headNounBonus + exactBonus + stateBonus + stateBaseBonus;
      if (!best || score > best.score || (score === best.score && qualityDistance < best.qualityDistance) || (score === best.score && qualityDistance === best.qualityDistance && entry.id.localeCompare(best.entry.id) < 0)) {
        best = { entry, keyword: candidate.keyword, score, qualityDistance, kind: candidate.kind, field };
      }
    }
  }

  const entry = best?.entry ?? fallbackEntry;
  return {
    entry,
    assetUrl: entry.assetUrl,
    matchedKeyword: best?.keyword ?? null,
    detectedStates: best ? detectedStates : ["unknown"],
    matchKind: best?.kind ?? "fallback",
    matchedField: best?.field ?? null,
    score: best?.score ?? 0,
    reviewStatus: entry.review
  };
}
