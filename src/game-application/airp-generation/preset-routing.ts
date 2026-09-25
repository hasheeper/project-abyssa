import * as v from "../../game-core/contracts";
import { check, type PresetModule, type PresetOrigin, type PresetStage } from "./contracts";

/** Explicit opt-in metadata; never infer a stage from a user-defined module name. */
export function readPresetRouting(stages: unknown, origin: unknown, content: string): Pick<PresetModule, "stages" | "origin"> {
  if (stages === undefined && origin === undefined) return {};
  const list = v.list(stages, "module.stages", 2);
  check(list.length > 0 && new Set(list).size === list.length, "预设阶段必须非空且不重复。", "preset-routing");
  list.forEach(s => v.choice(s, ["planning", "writing"], "module.stage"));
  if (origin === undefined) return {stages: list as PresetStage[]};
  const o = v.record(origin, "module.origin", ["moduleId", "sourceSha256", "fragmentSha256", "ranges", "macros", "adaptation"]);
  v.text(o.moduleId, "origin.moduleId", 200); v.text(o.adaptation, "origin.adaptation", 2000, true);
  for (const key of ["sourceSha256", "fragmentSha256"] as const) check(typeof o[key] === "string" && /^[a-f0-9]{64}$/.test(o[key]), "预设片段来源摘要无效。", "preset-routing");
  check(v.sha256(content) === o.fragmentSha256, "预设片段与来源摘要不符；未静默改写原文。", "preset-routing");
  const ranges = v.list(o.ranges, "origin.ranges", 32); check(ranges.length > 0, "预设片段缺少来源位置。");
  let previous = 0;
  for (const raw of ranges) {
    const r = v.record(raw, "origin.range", ["start", "end"]), start = v.number(r.start, "range.start"), end = v.number(r.end, "range.end");
    check(Number.isInteger(start) && Number.isInteger(end) && start >= previous && end > start, "预设原文位置无效。"); previous = end;
  }
  v.list(o.macros, "origin.macros", 64).forEach(m => v.text(m, "origin.macro", 80));
  return {stages: list as PresetStage[], origin: o as PresetOrigin};
}
