import { resolveItemIcon } from "../../assets/icons/items/catalog";
import type { MemoryEntry } from "./memory-types";

// Journal vocabulary expands into existing catalogue terms. SVG paths and
// attribution remain owned by the shared Game Icons library.
const subjectAliases: readonly [RegExp, string][] = [
  [/早餐|早饭|早茶/, "茶壶"],
  [/毛毯|毯子|绒毯/, "布卷"],
  [/用餐|聚餐|宴席|家宴|晚餐|晚饭/, "餐具"],
  [/来信|信件|信封/, "信封"],
  [/手记|记事|日记/, "记录簿"],
  [/追踪|探路|岩窟|洞穴|海蚀洞/, "指南针"],
];
function matchWords(text: string) {
  const synonyms = subjectAliases.filter(([pattern]) => pattern.test(text)).map(([, term]) => term).join(" ");
  return resolveItemIcon({ name: text, category: synonyms });
}

export function resolveMemoryIcon(entry: Pick<MemoryEntry, "title" | "summary" | "preview" | "iconKeywords">) {
  for (const text of [...(entry.iconKeywords ?? []), entry.title, entry.summary ?? entry.preview]) {
    const match = matchWords(text);
    if (match.matchKind !== "fallback") return match;
  }
  return resolveItemIcon("记录簿");
}
