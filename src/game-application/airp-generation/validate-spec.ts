import * as v from "../../game-core/contracts";
import { check, parseSampling, type Specification } from "./contracts";
import { readPresetRouting } from "./preset-routing";

/** Validate persisted/user-editable data before compilation; no executable fields. */
export function validateSpecification(spec: Specification): void {
  v.assertJson(spec);
  v.record(spec, "spec", ["playerName", "sample", "resources", "preset", "orderId"]);
  v.text(spec.playerName, "playerName", 40); v.text(spec.orderId, "orderId", 200);
  const s = spec.sample;
  v.record(s, "sample", ["sourceKind", "id", "version", "title", "phase", "location", "actorIds", "selectedAction", "outcome", "facts", "memories"]);
  v.choice(s.sourceKind, ["sample"], "sourceKind"); v.choice(s.outcome, ["cleared", "extracted"], "outcome");
  for (const field of ["id", "title", "location", "selectedAction"] as const) v.text(s[field], field, 1000);
  v.number(s.version, "sample.version", 1); v.number(s.phase, "phase");
  v.ids(s.actorIds, "actorIds", 2); check(s.actorIds.includes("kael") && s.actorIds.includes("elora"), "样例演员不匹配。");
  v.list(s.facts, "facts", 24).forEach(raw => {
    const f = v.record(raw, "fact", ["id", "text", "knownBy"]);
    v.id(f.id, "fact.id"); v.text(f.text, "fact.text", 2000); v.ids(f.knownBy, "fact.knownBy", 8);
  });
  check(new Set(s.facts.map(f => f.id)).size === s.facts.length, "事实ID重复。");
  v.list(s.memories, "memories", 128).forEach(raw => {
    const m = v.record(raw, "memory", ["id", "summary", "phase", "actorIds", "sourceId", "read"]);
    v.id(m.id, "memory.id"); v.text(m.summary, "summary", 4096); v.text(m.sourceId, "sourceId", 200, true);
    v.number(m.phase, "memory.phase"); v.ids(m.actorIds, "memory.actorIds", 8); v.boolean(m.read, "read");
  });
  check(new Set(s.memories.map(m => m.id)).size === s.memories.length, "记忆ID重复。");
  validateGenerationMaterial(spec);
}

/** Shared material reader; the sample/gameplay source readers remain separate. */
export function validateGenerationMaterial(spec: Pick<Specification, "resources" | "preset" | "orderId">): void {
  v.text(spec.orderId, "orderId", 200);
  const r = spec.resources;
  v.record(r, "resources", ["version", "sources", "planning", "writing", "formatting"], r.version === 8 ? ["writingTaskRole"] : []);
  v.number(r.version, "resources.version", 2);
  check([2, 3, 4, 5, 6, 7, 8].includes(r.version), "资料装配版本不受支持；不能用当前规则猜测未来版本。");
  if (r.writingTaskRole !== undefined) v.choice(r.writingTaskRole, ["system", "user"], "resources.writingTaskRole");
  for (const field of ["planning", "writing", "formatting"] as const) v.text(r[field], field, 65536);
  v.list(r.sources, "sources", 32).forEach(raw => {
    const source = v.record(raw, "source", ["id", "kind", "path", "sha256", "text"], r.version >= 7 ? ["activation", "brief"] : []);
    for (const field of ["id", "path", "sha256"]) v.text(source[field], field, 4096);
    v.choice(source.kind, ["world", "character", "player", "guideline"], "source.kind");
    const text = v.text(source.text, "source.text", 2097152);
    check(/^[a-f0-9]{64}$/.test(String(source.sha256)), "来源摘要无效。");
    check(v.sha256(text) === source.sha256, "资料原文与摘要不符；不接受静默删改。");
    if (r.version >= 7 && source.kind === "world") {
      const a = v.record(source.activation, "source.activation", ["always", "keywords"]);
      v.boolean(a.always, "activation.always");
      const keys = v.list(a.keywords, "activation.keywords", 100);
      keys.forEach(k => v.text(k, "activation.keyword", 100));
      check(a.always || keys.length, "按需世界资料必须有触发词。");
    }
    if (r.version >= 7 && source.kind === "character") v.text(source.brief, "source.brief", 4096);
    check(source.activation === undefined || source.kind === "world", "只有世界资料可声明关键词触发。");
    check(source.brief === undefined || source.kind === "character", "只有角色卡可附非在场简稿。");
  });
  check(r.sources.some(s => s.kind === "character") && r.sources.some(s => s.kind === "world"), "缺少完整角色卡或世界设定。");
  check(new Set(r.sources.map(s => s.id)).size === r.sources.length, "资料ID重复。");
  const p = spec.preset;
  v.record(p, "preset", ["name", "planningPrefix", "modules", "orders", "sampling", "notes"]);
  v.text(p.name, "preset.name", 200); v.text(p.planningPrefix, "planningPrefix", 65536, true);
  v.list(p.modules, "modules", 512).forEach(raw => {
    const m = v.record(raw, "module", ["identifier", "name", "role", "content", "marker", "unsupported"], r.version === 8 ? ["stages", "origin"] : []);
    v.text(m.identifier, "identifier", 200); v.text(m.name, "module.name", 1000, true); v.text(m.content, "content", 65536, true);
    v.choice(m.role, ["system", "user", "assistant"], "role"); v.boolean(m.marker, "marker");
    v.list(m.unsupported, "unsupported", 16).forEach(item => v.text(item, "unsupported.item", 200));
    if (r.version === 8) readPresetRouting(m.stages, m.origin, m.content as string);
  });
  check(new Set(p.modules.map(m => m.identifier)).size === p.modules.length, "预设模块重复。");
  v.list(p.orders, "orders", 64).forEach(raw => {
    const o = v.record(raw, "order", ["id", "entries"]); v.text(o.id, "order.id", 200);
    const entries = v.list(o.entries, "entries", 512).map(raw => {
      const e = v.record(raw, "entry", ["identifier", "enabled"]); v.text(e.identifier, "entry.identifier", 200); v.boolean(e.enabled, "enabled");
      check(p.modules.some(m => m.identifier === e.identifier), "顺序引用不存在的模块。"); return e.identifier;
    });
    check(new Set(entries).size === entries.length, "执行顺序重复。");
  });
  check(p.orders.length && new Set(p.orders.map(o => o.id)).size === p.orders.length, "预设顺序无效。");
  v.record(p.sampling, "sampling", [], ["temperature", "top_p", "max_tokens"]); parseSampling(p.sampling);
  v.list(p.notes, "notes", 128).forEach(item => v.text(item, "note", 2000));
}
