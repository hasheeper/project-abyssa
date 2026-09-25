import { check, type SourceDocument } from "./contracts";

// Do not recursively trigger from cards, preset text, future branches or loaded lore.
const ignored = new Set(["card", "authorSource", "unknown", "head", "proof", "contentDigest", "bodyHash", "sourceId", "evidenceIds", "playerName", "id", "choices"]);
function sceneStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sceneStrings);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => ignored.has(key) ? [] : sceneStrings(child));
  return [];
}

export function selectSceneSources(sources: SourceDocument[], actors: Record<string, string>, context: unknown, history: string) {
  for (const id of Object.keys(actors)) check(sources.some(s => s.kind === "character" && s.id === id), `缺少在场角色${id}的完整卡，禁止降级简稿。`);
  const haystack = [...sceneStrings(context), history].join("\n").toLowerCase();
  const full: SourceDocument[] = [], briefs: {id: string; path: string; sha256: string; text: string}[] = [], diagnostics: string[] = [];
  for (const s of sources) {
    if (s.kind === "character" && !Object.hasOwn(actors, s.id)) {
      check(s.brief && s.brief.trim(), `缺少非在场角色${s.id}简稿，未擅自截取原卡。`);
      briefs.push({id: s.id, path: s.path, sha256: s.sha256, text: s.brief});
      diagnostics.push(`${s.id}：非在场简稿，不加载完整卡`);
    } else if (s.kind === "world") {
      check(s.activation, `世界资料${s.id}缺少触发规则。`);
      const matches = s.activation.keywords.filter(k => haystack.includes(k.toLowerCase()));
      if (s.activation.always || matches.length) full.push(s);
      diagnostics.push(`${s.id}：${s.activation.always ? "基础常驻全文" : matches.length ? `触发全文（${matches.join("、")}）` : "未触发，不加载"}`);
    } else {
      full.push(s);
      diagnostics.push(`${s.id}：${s.kind === "character" ? "在场角色卡全文" : "常驻全文"}`);
    }
  }
  return {full, briefs, diagnostics};
}
