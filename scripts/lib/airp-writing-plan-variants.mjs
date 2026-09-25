import assert from 'node:assert/strict';

export const writingPlanVariants = ['with-plan', 'without-plan'];

/** Only remove the writer's added editorial exercise and its response envelope.
 * Frozen scene_plan, original preset bodies, author sources and AVG rules stay intact.
 * Exact anchors fail closed when prompts change; never use broad regex deletion. */
export function createWritingPlanInput(input, variant, performanceGuide) {
  assert(writingPlanVariants.includes(variant), 'Unknown writing Plan variant');
  const result = structuredClone(input), changes = [];
  if (variant === 'with-plan') return { input: result, changes };
  function replaceOnce(before, after, reason) {
    let found = 0;
    for (const message of result.messages) {
      const occurrences = message.content.split(before).length - 1;
      found += occurrences;
      if (occurrences) message.content = message.content.replace(before, after);
    }
    assert.equal(found, 1, `Expected one exact prompt anchor: ${reason}`);
    changes.push({ reason, before, after });
  }
  const languageStart = performanceGuide.indexOf('【语言协议锁】复述并执行：');
  const languageEnd = performanceGuide.indexOf('\n【正文响应封装】', languageStart);
  assert(languageStart >= 0 && languageEnd > languageStart, 'Missing standalone bilingual instruction');
  const language = performanceGuide.slice(languageStart, languageEnd).replace('复述并执行：', '执行：');
  replaceOnce(performanceGuide, `${language}
【正文响应封装】只用一个 <prose>...</prose> 保存完整最终正文；区块之外不输出其他内容，不使用代码围栏。prose只含最终正文自然段，独立对白用「日本語原文（中文翻译）」；不包含检查记录、大纲、JSON、游戏命令或其他标签。`, 'remove writer editorial exercise; retain bilingual rules');
  replaceOnce('正文按本阶段协议分开交付planning编辑记录与prose终稿，只有prose属于故事。', '正文按本阶段协议只交付prose终稿。', 'input binding for explicit prose-only contract');
  replaceOnce('下方正文侧角色演出校正另存为编辑作品，不与故事段落交错。', '', 'remove writer editorial reference in thinking_format');
  replaceOnce('；编辑记录按下方独立封装。', '。', 'remove editorial delivery reference');
  replaceOnce('大纲中的动机分析、事实检查和正文侧编辑记录不变成玩家阅读的旁白', '大纲中的动机分析、事实检查不变成玩家阅读的旁白', 'remove reference to absent editorial record, retain AVG rule');
  replaceOnce('最终响应严格为 <planning>逐角色本音校正与语言协议</planning> 然后 <prose>完整故事自然段</prose>，两个区块都必须完整闭合', '最终响应严格为 <prose>完整故事自然段</prose>，区块必须完整闭合', 'final task for explicit prose-only contract');
  result.bytes = result.messages.reduce((sum, message) => sum + Buffer.byteLength(message.content, 'utf8'), 0);
  return { input: result, changes };
}

/** Reader-screen counts, not hard quotas or an automatic literary-quality verdict. */
export function measureAvgProse(prose) {
  const paragraphs = prose.split(/\r?\n/).map(text => text.trim()).filter(Boolean);
  const narrator = [], dialogue = []; let run = 0, longestNarratorRun = 0;
  for (const text of paragraphs) {
    const isDialogue = text.startsWith('「');
    (isDialogue ? dialogue : narrator).push(text);
    run = isDialogue ? 0 : run + 1; longestNarratorRun = Math.max(longestNarratorRun, run);
  }
  const length = text => [...text].length;
  const longest = lines => Math.max(0, ...lines.map(length));
  return {
    pages: paragraphs.length, dialoguePages: dialogue.length, narratorPages: narrator.length,
    dialoguePercent: paragraphs.length ? Number((dialogue.length / paragraphs.length * 100).toFixed(1)) : 0,
    longestNarratorRun, longestNarrator: longest(narrator), longestDialogue: longest(dialogue),
    narratorCharacters: narrator.reduce((sum, text) => sum + length(text), 0),
    dialogueCharacters: dialogue.reduce((sum, text) => sum + length(text), 0),
  };
}
