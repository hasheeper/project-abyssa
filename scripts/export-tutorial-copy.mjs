/** Read-only FULL copy inventory, including scenes and shared UI. Prints JSON only.
 * Historical edited copies live in docs/archive/exports/; never overwrite them.
 * Their unresolved differences need human review, not automatic writeback.
 * This script never writes files, gameplay data, or either archived export. */
import { parse } from "@babel/parser";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { projectRoot } from "../config/paths.mjs";

const sources = [
  ["current", "01 · 教程总览", "src/apps/battle/presentation/TutorialOverview.tsx"],
  ["current", "02 · 全部带做提示（首次说明与复用提示）", "src/content/presentation/tutorial/guided-tide.json"],
  ["current", "03 · 教程专用战术对白", "src/content/presentation/tutorial/tide-tactical.json"],
  ["current", "04 · 内容12六场定稿（S3-1至S3-5、S4-1）", "src/content/presentation/scenes/tide-cave-chapter-one.json"],
  ["current", "04a · 当前玩法手册（包括段落、操作和规则表）", "src/content/presentation/tutorial/handbook.json"],
  ["current", "04b · 内容12目录及诺玛E1", "src/content/gameplay/demo-v12/content.ts"],
  ["current", "05 · 事件叙述、战间整备、失败重试与领取", "src/apps/battle/presentation/TideJourneyPanel.tsx"],
  ["current", "06 · 菜单、退出带做、Boss目标", "src/apps/battle/ManorBattleView.tsx"],
  ["current", "07 · 教程出发与返回", "src/apps/battle/TutorialDeparture.tsx"],
  ["current", "08 · 提示确认", "src/apps/battle/presentation/TideTutorialGuide.tsx"],
  ["current", "09 · 场景名称", "src/content/presentation/tide-cave.ts"],
  ["legacy", "10 · 内容11 E1目录及旧事件描述（12继承后覆盖）", "src/content/gameplay/demo-v11/content.ts"],
  ["current", "11 · 教程敌人名称（内容12继承）", "src/content/gameplay/demo-v7/content.ts"],
  ["entrance", "12 · 新游戏章节选择", "src/apps/title/NewGameDialog.tsx"],
  ["entrance", "13 · 前置首晨剧情与选项", "src/content/presentation/scenes/first-morning.json"],
  ["entrance", "14 · 首晨页面提示", "src/game-client/FirstMorningStory.tsx"],
  ["entrance", "15 · 更早的开场序幕台词", "src/apps/prologue/script.ts"],
  ["entrance", "16 · 序幕播放按钮", "src/apps/prologue/ProloguePlayer.tsx"],
  ["shared", "17 · 事件共用面板（包含庄园其他分支，非全部用于E1）", "src/apps/battle/presentation/ManorJourneyPanel.tsx"],
  ["shared", "18 · 事件结果与演出", "src/apps/battle/presentation/manor-event-presentation.ts"],
  ["shared", "19 · 倍率、金币与战斗账本", "src/apps/battle/presentation/ExpeditionLedger.tsx"],
  ["shared", "20 · 倍率仪表及账本按钮", "src/apps/battle/presentation/ExpeditionBattleLedger.tsx"],
  ["shared", "21 · 骰子操作与悬停说明", "src/apps/battle/presentation/ExpeditionDicePanel.tsx"],
  ["shared", "22 · 骰面名称及状态提示", "src/apps/battle/ExpeditionDie3D.tsx"],
  ["shared", "23 · 骰面图例文字", "src/shared/ui/dice-face/ExpeditionFlatDieFrame.tsx"],
  ["shared", "24 · 牌型读数、回合与清层反馈", "src/apps/battle/presentation/ExpeditionBattleChrome.tsx"],
  ["shared", "25 · 战场目标与意图提示", "src/apps/battle/presentation/ExpeditionBattleSurface.tsx"],
  ["shared", "26 · 战场操作预览", "src/apps/battle/presentation/manor-battle-model.ts"],
  ["shared", "27 · 角色反应栏", "src/apps/battle/presentation/ExpeditionBattleSidebar.tsx"],
  ["shared", "28 · 通用角色战斗气泡（教程静默阶段不一定播放）", "src/content/presentation/battle-reactions.ts"],
  ["shared", "29 · 道具使用与状态", "src/shared/ui/patterns/action-dock/ItemDock.tsx"],
  ["shared", "30 · 教学浮层按钮", "src/shared/tutorial/TutorialProvider.tsx"],
  ["shared", "31 · 旅途菜单", "src/shared/ui/patterns/game-menu/GameMenu.tsx"],
  ["shared", "32 · 游戏菜单命令与导航", "src/game-client/CampaignPanel.tsx"],
  ["shared", "33 · 剧情阅读按钮", "src/game-client/StoryReading.tsx"],
  ["shared", "34 · AVG阅读控件", "src/shared/presentation/adv/AdvStage.tsx"],
  ["shared", "35 · 剧情与战斗转场", "src/shared/presentation/adv/SceneSequence.tsx"],
  ["shared", "36 · 战斗日志与返馆回执（包含其他路线分支）", "src/game-runtime/manor-log.ts"],
  ["shared", "37 · 队员及原生骰面名称", "src/content/gameplay/demo-v1/characters.ts"],
  ["shared", "38 · 存档、命令失败等错误提示", "src/game-client/game-errors.ts"],
  ["shared", "39 · 查询产生的道具不可用提示", "src/game-runtime/demo-journey-view.ts"],
  ["shared", "40 · 配给名称及共用事件原文（含非教程内容）", "src/content/gameplay/demo-v1/manor.ts"],
  ["shared", "41 · 楼层及回合读数", "src/apps/battle/presentation/CompanionStatus.tsx"],
  ["shared", "42 · 掷骰与道具坞共用按钮", "src/shared/ui/patterns/action-dock/ActionDock.tsx"],
  ["shared", "43 · 首晨场景衔接", "src/content/presentation/first-morning.ts"],
  ["shared", "44 · 通用加载提示", "src/game-client/GameLoading.tsx"],
  ["shared", "45 · 路由切换提示", "src/game-shell/GameShell.tsx"],
  ["shared", "46 · 道具效果短说明", "src/content/presentation/supply-icons.ts"],
  ["legacy", "附录A · 旧版四房教程剧情，勿与内容11混用", "src/content/presentation/scenes/tide-cave.json"],
  ["legacy", "附录B · 旧版岩窟提示", "src/content/presentation/tutorial/tide-cave.json"],
  ["legacy", "附录B2 · 内容11七场旧稿（包括S4-2）", "src/content/presentation/scenes/tide-cave-guided.json"],
  ["shared", "附录C · 手动帮助与旧版基础提示", "src/content/presentation/tutorial/battle-basics.json"],
];
const hasHan = value => /\p{Script=Han}/u.test(value);
const englishCopy = /^(?:ROLL|REROLL|END TURN|BATTLE LOG|Loading…|CHAPTER \d+|PLAY GUIDE|USER|EUSTICIE|EUSTICE|ELORA|KORORO|NORMA|MARIETTA)$/;
const textFields = new Set(["title", "text", "label", "prompt", "description", "conditions", "eyebrow", "location", "resultTitle"]);
const castNames = {kael: "玩家／凯尔", eustice: "尤斯缇丝", elora: "艾洛拉", kororo: "柯萝萝", norma: "诺玛", marietta: "玛丽埃塔", abyssa: "艾比希斯"};
const digest = value => createHash("sha256").update(value).digest("hex");
const pointer = path => "/" + path.map(p => String(p).replaceAll("~", "~0").replaceAll("/", "~1")).join("/");

function jsonEntries(data) {
  const entries = [];
  function walk(value, path = [], context = {}) {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, [...path, i], context));
    if (!value || typeof value !== "object") return;
    const current = {...context};
    if (value.sectionId) current.section = value.sectionId;
    if (value.id) current.node = value.id;
    if (value.kind === "narration") current.speaker = "旁白";
    if (value.actorId) current.speaker = castNames[value.actorId] ?? value.actorId;
    if (value.emotion) current.emotion = value.emotion;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && textFields.has(key)) entries.push({key: pointer([...path, key]), ...current, text: child});
      else walk(child, [...path, key], current);
    }
  }
  walk(data);
  return entries;
}

// Handbook arrays carry visible prose/table cells, unlike scene metadata.
// Keep diagram labels and numerical strings, but omit IDs and asset references.
function handbookEntries(data) {
  const metadata = new Set(["id", "chapter", "section", "figure", "figureLayout", "rowIcons", "itemIcons", "table"]);
  const entries = [];
  function walk(value, path = []) {
    if (typeof value === "string") {
      if (value.trim()) entries.push({key: pointer(path), text: value});
    } else if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, [...path, index]));
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) if (!metadata.has(key)) walk(child, [...path, key]);
    }
  }
  walk(data);
  return entries;
}

function codeEntries(code, path) {
  const file = parse(code, {sourceType: "module", plugins: ["typescript", ...(path.endsWith(".tsx") ? ["jsx"] : [])]});
  const parents = new WeakMap();
  const children = node => Object.entries(node).flatMap(([key, value]) =>
    ["comments", "leadingComments", "trailingComments", "innerComments", "tokens"].includes(key) ? [] :
      Array.isArray(value) ? value.filter(v => v && typeof v.type === "string") : value && typeof value.type === "string" ? [value] : []);
  function index(node) {for (const child of children(node)) {parents.set(child, node); index(child);}}
  index(file);
  const raw = node => code.slice(node.start, node.end);
  const entries = [];
  const location = node => `L${node.loc.start.line}:C${node.loc.start.column + 1}`;
  function context(node) {
    const names = [];
    for (let n = parents.get(node); n; n = parents.get(n)) {
      if (["FunctionDeclaration", "VariableDeclarator"].includes(n.type) && n.id) names.unshift(raw(n.id));
      if (n.type === "ObjectProperty") names.unshift(raw(n.key));
      if (n.type === "JSXAttribute") names.unshift(raw(n.name));
      if (n.type === "ArrayExpression") names.unshift(`[${n.elements.findIndex(e => e && node.start >= e.start && node.end <= e.end)}]`);
    }
    return names.join(" > ");
  }
  function add(node, text, kind, bindings = {}) {
    if (!text.trim() || !(hasHan(text) || englishCopy.test(text.trim()))) return;
    entries.push({key: location(node), context: context(node), kind, text, ...(Object.keys(bindings).length ? {bindings} : {})});
  }
  // Preserve an inline JSX paragraph as one editable sentence, not disconnected fragments.
  function inline(node, bindings) {
    if (node.type === "JSXText") return node.value.replace(/\s+/g, " ");
    if (node.type === "JSXExpressionContainer") {
      if (node.expression.type === "JSXEmptyExpression") return "";
      if (node.expression.type === "StringLiteral") return node.expression.value;
      if (node.expression.type === "ConditionalExpression" || hasHan(raw(node.expression)) || node.expression.type === "JSXElement") return null;
      const key = `value${Object.keys(bindings).length + 1}`;
      bindings[key] = raw(node.expression);
      return `{${key}}`;
    }
    if (node.type === "JSXElement" && /^(b|strong|small|span|em|i)$/.test(raw(node.openingElement.name))) {
      const parts = node.children.map(child => inline(child, bindings));
      return parts.includes(null) ? null : parts.join("");
    }
    return null;
  }
  function attributes(node) {
    if (node.type === "JSXElement") {
      node.openingElement.attributes.forEach(visit);
      node.children.forEach(child => {if (child.type === "JSXElement") attributes(child);});
    }
  }
  function visit(node) {
    if (node.type.startsWith("TS")) {
      if (["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion"].includes(node.type)) visit(node.expression);
      return;
    }
    if (node.type === "ImportDeclaration") return;
    if (node.type === "JSXElement") {
      const bindings = {}, parts = node.children.map(child => inline(child, bindings));
      const text = parts.includes(null) ? null : parts.join("").trim();
      if (text && (hasHan(text) || englishCopy.test(text))) {
        add(node, text, "jsx", bindings); attributes(node); return;
      }
    }
    if (node.type === "TemplateLiteral") {
      const bindings = {};
      let text = node.quasis[0].value.cooked;
      node.expressions.forEach((expression, i) => {
        const key = `value${i + 1}`;
        bindings[key] = raw(expression);
        text += `{${key}}${node.quasis[i + 1].value.cooked}`;
      });
      add(node, text, "template", bindings);
      node.expressions.forEach(visit);
      return;
    }
    if (node.type === "StringLiteral") {
      const parent = parents.get(node);
      if (parent?.type === "ObjectProperty" && parent.key === node) return;
      const attr = parent?.type === "JSXAttribute" ? raw(parent.name) : "";
      add(node, node.value, attr.startsWith("aria-") || attr === "alt" ? "accessibility" : "literal");
      return;
    }
    if (node.type === "JSXText") {add(node, node.value.replace(/\s+/g, " ").trim(), "jsx-fragment"); return;}
    children(node).forEach(visit);
  }
  visit(file);
  if (new Set(entries.map(e => e.key)).size !== entries.length) throw Error(`Duplicate locations in ${path}`);
  return entries;
}

const sections = [];
for (const [scope, title, path] of sources) {
  const code = await readFile(resolve(projectRoot, path), "utf8");
  const entries = path.endsWith("/handbook.json") ? handbookEntries(JSON.parse(code)) : path.endsWith(".json") ? jsonEntries(JSON.parse(code)) : codeEntries(code, path);
  sections.push({scope, title, source: path, sourceSha256: digest(code), entries});
}
const guided = JSON.parse(await readFile(resolve(projectRoot, "src/content/presentation/tutorial/guided-tide.json"), "utf8"));
const output = {
  _readme: {
    title: "Abyssa 教程文案只读盘点",
    date: "2026-09-19",
    scope: "当前内容12：玩法手册、总览、逐步提示、战术对白、六场章一定稿、事件、整备、结算；附入口/首晨/序幕、共用界面及明确标记的旧版文案。不是整个游戏或设定资料全集，也不表示所有候选条目都会显示。",
    status: "原样提取，不润色；未接入运行时，编辑本文件不会立即改变游戏。",
    editing: [
      "主要编辑 sections[].entries[].text。source、key、sourceSha256及bindings用于定位回填，请保留。",
      "current为当前教程专用；entrance为前置章节；shared含其他模式分支，不代表每句都会在教程出现；legacy为旧档文案。",
      "JSON来源的key是原字段JSON Pointer；TS/TSX来源的key是原行列，context辅助定位。",
      "保留 {handFactor} 等现有占位符、{{user}}、以及有bindings说明的 {value1} 等占位符；这些值由游戏生成。",
      "jsx条目合并了同一句中的加粗等内联标签；jsx-fragment是条件分支旁的文字片段，不应单独当作完整台词。",
      "accessibility是读屏/辅助标签；同文异处仍分别列出，没有按文字去重。",
      "同一个教学提示可能复用于多步，instructionOverrides列出首次或特殊步骤的覆盖关系。",
      "如需制作新的编辑副本，请另存文件；不要覆盖docs/archive/exports下两份含未决差异的旧稿。newCopy可记录新增建议，但没有自动回填功能。",
      "修改后需人工核对并回填原文件，尤其是共享文案、动态表达式和带目录摘要的内容名称；不要直接用本文件替换存档或内容目录。"
    ],
    sourceCount: sections.length,
    entryCount: sections.reduce((n, s) => n + s.entries.length, 0)
  },
  instructionOverrides: guided.instructions,
  sections,
  newCopy: []
};
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
