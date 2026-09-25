import { bytes, check, LIMITS, object, parseSampling, string, type Message, type Preset, type PresetStage } from "./contracts";
import { readPresetRouting } from "./preset-routing";

const markers: Record<string, string> = { charDescription: "description", charPersonality: "personality", scenario: "scenario", personaDescription: "persona", dialogueExamples: "examples", chatHistory: "history", worldInfoBefore: "world", worldInfoAfter: "world" };
const aliases: Record<string, string> = { charDescription: "description", charPersonality: "personality", personaDescription: "persona", mesExamples: "examples", example_dialogue: "examples", chatHistory: "history" };

/** A documented subset, not a script host. Parsing never executes module content. */
export function parsePreset(text: string, fallbackName = "导入预设"): Preset {
  check(bytes(text) <= LIMITS.presetBytes, "预设文件超过 2 MiB。", "preset-size");
  let raw: unknown; try { raw = JSON.parse(text); } catch { throw new Error("预设不是有效 JSON。"); }
  const r = object(raw);
  check(Array.isArray(r.prompts) && r.prompts.length <= 512, "预设需要 prompts 数组（最多512项）。");
  check(Array.isArray(r.prompt_order) && r.prompt_order.length > 0 && r.prompt_order.length <= 64, "预设需要明确的 prompt_order。");
  const notes: string[] = [];
  const modules = r.prompts.map((value: unknown) => {
    const p = object(value), identifier = string(p.identifier, "identifier", 200);
    check(identifier.length > 0, "模块 identifier 不能为空。");
    const role = p.role ?? "system";
    check(["system", "user", "assistant"].includes(String(role)), `${identifier} 的 role 不受支持。`);
    const unsupported: string[] = [];
    if (p.injection_position !== undefined && p.injection_position !== 0) unsupported.push("深度插入");
    if (p.injection_trigger !== undefined && (!Array.isArray(p.injection_trigger) || p.injection_trigger.length > 0)) unsupported.push("条件触发");
    if (p.extensions && Object.keys(object(p.extensions)).length) unsupported.push("模块扩展");
    const content = string(p.content ?? "", "content");
    return { identifier, name: typeof p.name === "string" ? p.name : identifier, role: role as Message["role"], content, marker: p.marker === true, unsupported,
      ...readPresetRouting(p.airp_stages, p.airp_origin, content) };
  });
  check(new Set(modules.map(p => p.identifier)).size === modules.length, "预设有重复 identifier。");
  const orders = r.prompt_order.map((value: unknown) => {
    const order = object(value), id = String(order.character_id ?? "");
    check(id.length > 0 && Array.isArray(order.order) && order.order.length <= 512, "prompt_order 缺少身份或顺序。");
    const entries = order.order.map((value: unknown) => {
      const e = object(value), identifier = string(e.identifier, "order.identifier", 200);
      check(typeof e.enabled === "boolean", `${identifier} 缺少 enabled 状态。`);
      check(modules.some(p => p.identifier === identifier), `顺序引用不存在的模块：${identifier}`);
      return { identifier, enabled: e.enabled };
    });
    check(new Set(entries.map(e => e.identifier)).size === entries.length, "同一顺序中模块重复。");
    return { id, entries };
  });
  check(new Set(orders.map(o => o.id)).size === orders.length, "预设顺序身份重复。");
  const known = new Set(["name", "prompts", "prompt_order", "temperature", "top_p", "max_tokens", "openai_max_tokens", "airp_planning_prefix", "airp_source"]);
  if (r.airp_source !== undefined) {
    const source = object(r.airp_source), digest = string(source.sha256, "来源摘要", 64);
    check(/^[a-f0-9]{64}$/.test(digest), "预设来源摘要无效。");
    notes.push(`原文来源：${string(source.filename, "来源文件", 200)} / SHA256 ${digest} / ${string(source.revision, "适配版本", 100)} / 原order ${string(source.orderId, "原顺序", 200)}`);
  }
  for (const key of Object.keys(r)) if (!known.has(key)) notes.push(`未采用预设字段：${key}`);
  const max = r.max_tokens ?? r.openai_max_tokens;
  const sampling = parseSampling({ temperature: r.temperature, top_p: r.top_p, max_tokens: max });
  return { name: typeof r.name === "string" ? r.name.slice(0, 200) : fallbackName, planningPrefix: string(r.airp_planning_prefix ?? "", "大纲前置提示词"), modules, orders, sampling, notes };
}

/** Only the original template is parsed; substituted reference data is always literal. */
export function createMacroCompiler(values: Record<string, string>) {
  const variables = new Map<string, string>(); let operations = 0;
  const expand = (source: string, depth = 0): string => {
    check(depth <= 8, "宏嵌套超过8层。", "preset-macro");
    let output = "", cursor = 0;
    while (cursor < source.length) {
      const at = source.indexOf("{{", cursor);
      if (at < 0) { output += source.slice(cursor); break; }
      output += source.slice(cursor, at); let end = at + 2, nesting = 1;
      for (; end < source.length && nesting; end++) {
        if (source.slice(end, end + 2) === "{{") { nesting++; end++; }
        else if (source.slice(end, end + 2) === "}}") { nesting--; if (nesting) end++; else break; }
      }
      check(nesting === 0, "存在未闭合宏。", "preset-macro");
      check(++operations <= 4096, "宏执行次数超限。", "preset-macro");
      const body = source.slice(at + 2, end), separator = body.indexOf("::"), command = (separator < 0 ? body : body.slice(0, separator)).trim();
      if (command === "trim") {
        output = output.replace(/\s+$/, "");
      } else if (command.startsWith("//")) {
        // Comments are non-output data; never execute their contents.
      } else if (command === "setvar") {
        const rest = body.slice(separator + 2), split = rest.indexOf("::");
        check(separator >= 0 && split > 0, "setvar 需要名称和值。", "preset-macro");
        const name = rest.slice(0, split).trim(); check(/^[\w.-]{1,80}$/.test(name), "临时变量名无效。", "preset-macro");
        variables.set(name, expand(rest.slice(split + 2), depth + 1));
        check(variables.size <= 64, "临时变量超过64项。", "preset-macro");
      } else if (command === "getvar") {
        const name = body.slice(separator + 2).trim(); check(separator >= 0 && variables.has(name), `未定义临时变量：${name}`, "preset-macro"); output += variables.get(name)!;
      } else {
        check(separator < 0, `不支持宏：${command}`, "preset-macro");
        const key = aliases[command] ?? command;
        check(Object.hasOwn(values, key), `未识别宏：${command}`, "preset-macro"); output += values[key];
      }
      cursor = end + 2;
      if (command === "trim") while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
      check(bytes(output) <= LIMITS.inputBytes, "宏展开文本超过2 MiB防御上限。", "preset-size");
    }
    check(bytes(output) <= LIMITS.inputBytes, "预设文本超过2 MiB防御上限。", "preset-size"); return output;
  };
  return expand;
}

export function compilePreset(preset: Preset, orderId: string, values: Record<string, string>, stage?: PresetStage) {
  const order = preset.orders.find(o => o.id === orderId); check(order, "请选择一个预设顺序。");
  const expand = createMacroCompiler(values), messages: Message[] = [], diagnostics = [...preset.notes];
  for (const entry of order.entries) {
    if (!entry.enabled) continue;
    const p = preset.modules.find(m => m.identifier === entry.identifier)!;
    check(p, "预设顺序包含未知模块。");
    if (stage) {
      check(p.stages?.length, `v8预设条目“${p.name}”未声明airp_stages；请使用分阶段预设或先标明归属，未猜测、未调用模型。`, "preset-routing");
      readPresetRouting(p.stages, p.origin, p.content);
      if (!p.stages.includes(stage)) {diagnostics.push(`${p.name}：不属于${stage}，未注入`); continue;}
      if (p.origin) diagnostics.push(`${p.name}：来源${p.origin.moduleId} / ${p.origin.ranges.map(r => `${r.start}:${r.end}`).join(",")} / ${p.origin.fragmentSha256}；${p.origin.adaptation}`);
    }
    check(p.unsupported.length === 0, `${p.name} 启用了尚未支持的功能：${p.unsupported.join("、")}`, "preset-unsupported");
    let content: string;
    if (p.marker) {
      const key = markers[p.identifier]; check(key && Object.hasOwn(values, key), `未知启用插槽：${p.identifier}`, "preset-marker"); content = values[key];
    } else content = expand(p.content);
    diagnostics.push(`${p.name}：${content.trim() ? `${bytes(content)} bytes` : "本场为空"}`);
    if (content.trim()) messages.push({ role: p.role, content });
  }
  check(messages.length > 0, "启用的预设没有可发送内容。");
  return { messages, diagnostics };
}
