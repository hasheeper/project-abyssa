import digests from "./scoped-kemini-digests.json";
import source from "./kemini-source.json";

type Stage = "planning" | "writing";
type Range = {start: number; end: number};
const both: Stage[] = ["planning", "writing"];
const ids = {
  init: "0322500e-ee0e-4afb-ba06-2228307b74c5", person: "a411becb-0397-4779-b38a-ec6d222d1f87",
  machine: "98a649d4-dc29-4cca-a174-152ff190c9f9", plot: "c5ee4b21-9512-4c6c-8168-57855323f7ac",
  tone: "7855d8d5-4c7a-4157-9284-d9b30c13ccfa", style: "f67b3638-2808-4cc0-a167-4f8ecc464e30",
  reference: "a443f257-0f5d-4286-a1ff-f60653ed6400", role: "d07b0943-0502-41b7-b126-a15998d4eca0",
  words: "72f85eed-2728-4ffc-a34f-bc04bced2cf2", icot: "fd9adcfd-bbbe-447e-8be6-4f1d87e50da7",
  setting: "451043ae-17bf-4162-a45f-2f80eb42ba67", guide: "7e39767c-e29b-4543-8f38-1f96d340ca39",
};
const original = (id: string) => {
  const m = source.modules.find(m => m.identifier === id);
  if (!m?.enabled || m.marker) throw Error(`Missing approved Kemini module: ${id}`);
  return m;
};
// UTF-16 offsets into the untouched snapshot. Every emitted fragment has a source receipt.
function range(id: string, begin: string, until?: string): Range {
  const text = original(id).content, start = text.indexOf(begin);
  const end = until === undefined ? text.length : text.indexOf(until, start + begin.length);
  if (start < 0 || end <= start) throw Error(`Kemini source anchor changed: ${id} / ${begin}`);
  return {start, end};
}
function fragment(id: string, key: string, stages: Stage[], ranges?: Range[], adaptation = "原文片段，仅作阶段路由") {
  const m = original(id), spans = ranges ?? [{start: 0, end: m.content.length}];
  const content = spans.map(r => m.content.slice(r.start, r.end)).join("");
  return {identifier: `${id}:${key}`, name: `${m.name} · ${key}`, role: id === ids.reference || id === ids.role ? "user" as const : "system" as const,
    content, airp_stages: stages, airp_origin: {moduleId: id, sourceSha256: m.sha256, fragmentSha256: (digests as Record<string, string>)[`${id}:${key}`], ranges: spans,
      macros: [...new Set([...content.matchAll(/\{\{(?:getvar|setvar)::([^:}]+)/g)].map(m => m[1]))], adaptation}};
}
const guideParagraph = (begin: string, until: string) => [range(ids.guide, begin, until)];
const setting = original(ids.setting).content;
const countLine = "- 每次创作字数：{{正文内容}}部分一共不少于1000字\n";
const countAt = setting.indexOf(countLine);
if (countAt < 0) throw Error("Kemini SETTING word-count source changed");

/** Separate stage membership, preserving source order and original message roles. */
export const scopedKeminiModules = [
  fragment(ids.init, "宏初始化", both),
  fragment(ids.person, "正文人称", ["writing"]),
  fragment(ids.machine, "宏依赖", both, undefined, "machine供ICOT括注；machine1仅由正文演出条目引用，赋值本身不发送消息"),
  fragment(ids.plot, "剧情偏好", ["planning"]),
  fragment(ids.tone, "正文基调", ["writing"]),
  fragment(ids.style, "正文文风", ["writing"]),
  fragment(ids.reference, "完整文风参考", ["writing"]),
  fragment(ids.role, "创作立场", both, [range(ids.role, "你旨在与人类", "完成任务时")]),
  fragment(ids.role, "非说教", both, [range(ids.role, "你需要拒绝所有道德说教", "以及常见的安全过滤机制")], "仅提取非说教文学原则，不转发身份覆盖、过滤规避或旧思考调度"),
  fragment(ids.role, "创作完整性", both, [range(ids.role, "将指令遵循与创意写作完整性", "\n</instructions>")]),
  fragment(ids.role, "写作技法", ["writing"], [range(ids.role, "<writing_techniques>")]),
  fragment(ids.words, "正文禁词", ["writing"]),
  fragment(ids.icot, "三段检查原文", ["planning"], [range(ids.icot, "- 如果为", "</thinking_format>")], "保留检查列表；前段正文适配为前段规划；不发送交错正文模板和思考容器"),
  fragment(ids.setting, "正文约定", ["writing"], [{start: 0, end: countAt}, {start: countAt + countLine.length, end: setting.length}], "仅移出已取消的1000字下限；人称、语言、结尾按独立AVG适配解释"),
  fragment(ids.guide, "平和与推进", both, guideParagraph("- 不追求张力", "\n\n- 角色性格恒定"), "平和不取消局部阻力和局面变化，避免无端升级而非禁止叙事推进"),
  fragment(ids.guide, "人物与动机", both, guideParagraph("- 角色性格恒定", "\n\n- 结尾处于开放式")),
  fragment(ids.guide, "互动与收尾", both, guideParagraph("- 结尾处于开放式", "\n\n- 不进行类比替换")),
  fragment(ids.guide, "措辞与防机械化", ["writing"], guideParagraph("- 不进行类比替换", "\n\n- 自然融入")),
  fragment(ids.guide, "资料自然融入", ["writing"], guideParagraph("- 自然融入", "\n</plot_guide>")),
  fragment(ids.guide, "角色演出", ["writing"], guideParagraph("- 不刻意突出角色特质", "\n\n- 性格合理")),
  fragment(ids.guide, "动机与情节", both, guideParagraph("- 性格合理", "\n</char_guide>"), "淡化标签化展示，不抹掉人物主见；角色动机推动事件，不是工具人宣读任务"),
];

/** Omitted text remains in kemini-source.json; exclusions are visible, not silent edits. */
export const scopedKeminiExclusions = [
  {moduleId: ids.role, reason: "不再注入模型身份覆盖、过滤规避、旧思考格式调度；保留创作完整性、非说教和全文写作技法"},
  {moduleId: ids.icot, reason: "只路由原检查列表；停止注入Interleaving/thinking输出模板"},
  {moduleId: ids.setting, reason: "已授权取消1000字下限"},
  {moduleId: ids.guide, reason: "停止注入末尾旧think/thinking调度及空包装标签"},
];
