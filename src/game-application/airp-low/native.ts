import { canonicalJson, sha256, utf8Size } from "../../game-core/contracts";
import { check, type Message } from "../airp-generation/contracts";
import { parsePreset, createMacroCompiler } from "../airp-generation/preset";
import { selectSceneSources } from "../airp-generation/source-selection";
import type { LowExpressions, LowFrame, LowMaterial, LowSampling, LowScene } from "./contracts";
import {contextualRoleplayGuide, elasticProseLength, PROSE_ROLEPLAY_ID, PROSE_SETTING_ID} from "./prose-v1";
import { LOW_ATTITUDE_ONLY_INSTRUCTION, LOW_FORMAT_INSTRUCTION, LOW_NODE_HANDOFF, LOW_POSTPROCESS_INSTRUCTION, LOW_PHASE_FORMAT_INSTRUCTION, LOW_PHASE_PROGRAM_HANDOFF, LOW_CUMULATIVE_PHASE_FORMAT_INSTRUCTION, LOW_GM_FORMAT_INSTRUCTION } from "./prompt";

export const lowHash = (v: unknown) => sha256(canonicalJson(v));
export const cloneLow = <T>(v: T): T => JSON.parse(canonicalJson(v));
export const R8_PRESET_HASH = "4463c28021304707bd952b915498853f165d2b0039946b8c9350d021fd74b118";
/** Mechanical port of the frozen native strict text-role conversion; no placeholder injection. */
export function lowStrictMessages(messages: Message[]) {
  const merge = (input: Message[]) => input.reduce<Message[]>((all, m) => {
    check(m.content.length && ["system", "user", "assistant"].includes(m.role), "Invalid native message");
    if (all.at(-1)?.role === m.role) all[all.length - 1].content += "\n\n" + m.content; else all.push({ ...m });
    return all;
  }, []);
  const first = merge(messages);
  check(first[0]?.role === "user" || first[0]?.role === "system" && first[1]?.role === "user", "Native order requires unsupported placeholder");
  return merge(first.map((m, i) => i > 0 && m.role === "system" ? { ...m, role: "user" } : m));
}
export function lowExpressionPrompt(original: string, catalog: LowExpressions) {
  const prefix = original.split("\n通用差分："); check(prefix.length === 2, "Frozen expression template changed");
  return prefix[0] + `\n通用差分：${Object.entries(catalog.common).map(([id, label]) => `${id}=${label}`).join("、")}\n本场角色：\n${catalog.actors.map(a => `${a.name}（${a.id}）：${a.specials.length ? `专属 ${a.specials.join("、")}` : "仅通用项"}`).join("\n")}\n玩家${catalog.player.name}（${catalog.player.id}）：仅通用标记，静态头像。` + original.match(/[\r\n]*$/)![0];
}
/** Frozen r8 source/order with explicit, versioned runtime character and length guidance. */
export function compileLowFrame(material: LowMaterial, scene: LowScene, handoff = true, readerVersion?: 2 | 3 | 4 | 5 | 6): LowFrame {
  const raw = JSON.parse(material.preset);
  check(material.version === 1 && sha256(JSON.stringify(raw, null, 2)) === R8_PRESET_HASH, "r8 preset changed; no silent adaptation");
  const selected = selectSceneSources(material.sources, scene.actors, scene.sourceContext ?? scene.scenario, scene.userInput);
  for (const s of selected.full) check(sha256(s.text) === s.sha256, `Full source changed: ${s.id}`);
  const expressions: LowExpressions = { common: material.common, actors: Object.entries(scene.actors).map(([id, name]) => {
    check(Object.hasOwn(material.specials, id), `Missing expression profile: ${id}`); return { id, name, specials: material.specials[id] };
  }), player: scene.player };
  const people = [...expressions.actors, expressions.player];
  check(people.every(a => a.name.trim() && !/[\[\]：:\r\n]/.test(a.name)) && new Set(people.map(a => a.name)).size === people.length && new Set(people.map(a => a.id)).size === people.length, "Ambiguous scene actors");
  const p = parsePreset(material.preset), expression = p.modules.find(p => p.identifier === "airp-native-expression-output")!;
  expression.content = lowExpressionPrompt(expression.content, expressions);
  if (scene.proseVersion === 1) {
    const roleplay = p.modules.find(m => m.identifier === PROSE_ROLEPLAY_ID)!;
    roleplay.content = contextualRoleplayGuide(roleplay.content);
  }
  if (scene.pacing || scene.proseVersion === 1) {
    const settings = p.modules.find(m => m.identifier === PROSE_SETTING_ID)!;
    const original = "三段合计约600字，全篇共20个左右自然段";
    check(settings.content.includes(original), "Frozen length phrase changed");
    settings.content = settings.content.replace(original, scene.proseVersion === 1 ? elasticProseLength(scene.pacing?.suggestedWords)
      : `三段合计参考${scene.pacing!.suggestedWords}字，段数随本轮内容自然变化；这是GM按本轮信息量给出的软目标，不是最低字数`);
  }
  const world = selected.full.filter(s => s.kind === "world").map(s => s.text).join("\n\n");
  const persona = selected.full.filter(s => s.kind === "player").map(s => s.text).join("\n\n");
  check(world && persona, "Missing complete world/player source");
  const description = selected.full.filter(s => s.kind === "character").map(s => s.text).join("\n\n") + "\n\n【其他角色资料；本场不在场】\n" + selected.briefs.map(s => s.text).join("\n\n");
  const scenario = handoff ? `${LOW_NODE_HANDOFF}\n\n${scene.scenario}` : scene.scenario;
  const one = (content: string): Message[] => [{ role: "system", content }];
  const slots: Record<string, Message[]> = { agentSystemPrompt: [], agentTask: [], agentResults: [], worldInfoBefore: one(world), worldInfoAfter: [], personaDescription: one(persona), charDescription: one(description), charPersonality: [], scenario: one(scenario), dialogueExamples: [], chatHistory: [{ role: "user", content: scene.userInput }] };
  const expand = createMacroCompiler({ user: scene.player.name, char: Object.values(scene.actors).join("、"), world, persona, description, personality: "", scenario, examples: "", history: scene.userInput, "思考内容": "{{思考内容}}", "正文内容": "{{正文内容}}", "可能要求的附加内容": "{{可能要求的附加内容}}" });
  const messages: Message[] = [], trace: LowFrame["trace"] = [];
  for (const entry of p.orders.find(o => o.id === "100001")!.entries.filter(e => e.enabled)) {
    const m = p.modules.find(m => m.identifier === entry.identifier)!; check(!m.unsupported.length, "Unsupported native preset extension");
    const start = messages.length;
    if (m.marker) { check(Object.hasOwn(slots, m.identifier), "Unbound native marker"); messages.push(...slots[m.identifier].filter(m => m.content.trim())); }
    else { const content = expand(m.content); if (content.trim()) messages.push({ role: m.role, content }); }
    trace.push({ id: m.identifier, contentHash: sha256(m.content), indices: Array.from({ length: messages.length - start }, (_, i) => start + i) });
  }
  if (scene.currentTurn) messages.push({ role: "user", content: scene.currentTurn });
  const merged = lowStrictMessages(messages);
  check(merged.map(m => m.content).join("\n\n") === messages.map(m => m.content).join("\n\n"), "Native content reordered");
  check(utf8Size(JSON.stringify(merged)) <= 2 * 1024 * 1024, "Low full input exceeds capacity; nothing was trimmed");
  const sampling: LowSampling = { stream: raw.stream_openai, temperature: raw.temperature, top_p: raw.top_p, max_tokens: raw.openai_max_tokens, frequency_penalty: raw.frequency_penalty, presence_penalty: raw.presence_penalty, reasoning_effort: raw.reasoning_effort, n: raw.n };
  check(sampling.stream === true && sampling.n === 1 && sampling.max_tokens === 65535, "Unexpected frozen native sampling");
  const phaseInstruction = scene.dialogue?.previousRead !== undefined ? LOW_CUMULATIVE_PHASE_FORMAT_INSTRUCTION : LOW_PHASE_FORMAT_INSTRUCTION;
  const frame = { version: 1 as const, scene, expressions, messages: merged, sampling, materialHash: lowHash(material), sources: selected.full, briefs: selected.briefs, trace, formatInstruction: (scene.dialogue?.gmManaged ? LOW_GM_FORMAT_INSTRUCTION : readerVersion === 6 ? phaseInstruction + (scene.dialogue?.programDecisionPending !== undefined ? `\n${LOW_PHASE_PROGRAM_HANDOFF}` : "") : readerVersion === 5 ? LOW_POSTPROCESS_INSTRUCTION : LOW_FORMAT_INSTRUCTION) + (scene.choiceMode === "attitude-only" && readerVersion !== 6 ? `\n${LOW_ATTITUDE_ONLY_INSTRUCTION}` : ""), ...(readerVersion ? { readerVersion } : {}) };
  return cloneLow({ ...frame, requestHash: lowHash(frame) });
}
export function validateLowFrame(frame: LowFrame) {
  const { requestHash, ...input } = frame;
  check(frame.version === 1 && lowHash(input) === requestHash, "Frozen Low input changed");
  check(frame.readerVersion === undefined || [2, 3, 4, 5, 6].includes(frame.readerVersion), "Unsupported Low reader version");
  for (const s of frame.sources) check(sha256(s.text) === s.sha256, "Stored full source changed");
}
