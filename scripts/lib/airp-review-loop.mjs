// Isolated test-bench contracts. No game runtime, save mutation or network imports.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {digest, performancePlanBody, splitNativeChoiceTail} from './airp-native-baseline.mjs';

const IDS = {
  reference: 'a443f257-0f5d-4286-a1ff-f60653ed6400',
  rule: '7855d8d5-4c7a-4157-9284-d9b30c13ccfa',
  style: 'f67b3638-2808-4cc0-a167-4f8ecc464e30',
  setting: '451043ae-17bf-4162-a45f-2f80eb42ba67',
  guide: '7e39767c-e29b-4543-8f38-1f96d340ca39',
  literary: 'd07b0943-0502-41b7-b126-a15998d4eca0',
  words: '72f85eed-2728-4ffc-a34f-bc04bced2cf2',
};
export async function loadReviewBaseline(root) {
  const directory = path.join(root, 'docs/baselines/airp-style-r8');
  const read = file => fs.readFile(path.join(directory, file), 'utf8');
  const manifest = JSON.parse(await read('manifest.json'));
  for (const file of manifest.files) {
    const bytes = await fs.readFile(path.join(directory, file.path));
    assert.equal(bytes.length, file.bytes, 'Baseline file size changed: ' + file.path);
    assert.equal(digest(bytes), file.sha256, 'Baseline file changed: ' + file.path);
  }
  const [preset, request, response, scene, catalog, briefs] = await Promise.all(
    ['preset.json', 'request.json', 'response.json', 'scene.json', 'expression-catalog.json', 'context/absent-briefs.json']
      .map(async file => JSON.parse(await read(file))));
  const sources = await Promise.all(manifest.context.map(async source => {
    const data = (await fs.readFile(path.join(directory, source.snapshot))).subarray(0, source.originalBytes);
    assert.equal(digest(data), source.sha256);
    const text = data.toString();
    assert(request.messages.some(message => message.content.includes(text)), 'Missing baseline source');
    return {id: source.id, kind: 'original-full-source', text, sha256: digest(text)};
  }));
  for (let i = 0; i < briefs.length; i++) {
    assert(request.messages.some(message => message.content.includes(briefs[i].text)));
    sources.push({id: 'absent-' + i, kind: 'original-absent-brief', text: briefs[i].text, sha256: digest(briefs[i].text)});
  }
  for (const [id, text] of [
    ['scene', scene.scenario], ['player-input', scene.userInput],
    ['test-boundary', '本次是独立场景试稿，没有更早已读历史或已绑定的正式任务状态。只依据给定场景和玩家输入判断当前交互，不补造任务、奖励、未来分支或世界状态。角色称呼、关系和已知情况以原资料为准。'],
  ]) sources.push({id, kind: 'scene-evidence', text, sha256: digest(text)});
  assert.equal(new Set(sources.map(s => s.id)).size, sources.length);
  return {preset, request, response, scene, catalog, sources, originalDraft: performancePlanBody(response.text).body};
}

/** Expand original macros, then retain traceable text; never use a summary as a source. */
export function compileReviewMaterials(baseline, createMacroCompiler) {
  const {preset, scene, request} = baseline;
  const order = preset.prompt_order.find(o => String(o.character_id) === '100001').order;
  const modules = new Map(preset.prompts.map(p => [p.identifier, p]));
  const values = {user: scene.player.name, char: Object.values(scene.actors)[0],
    world: '', persona: '', description: '', personality: '', scenario: scene.scenario, examples: '', history: scene.userInput,
    '思考内容': '{{思考内容}}', '正文内容': '{{正文内容}}', '可能要求的附加内容': '{{可能要求的附加内容}}'};
  const expand = createMacroCompiler(values), expanded = new Map();
  for (const entry of order.filter(e => e.enabled)) {
    const module = modules.get(entry.identifier);
    if (!module.marker) expanded.set(entry.identifier, expand(module.content ?? ''));
  }
  const fragments = [], ordinal = id => order.findIndex(e => e.identifier === id);
  const add = (id, purpose, original, edits = [], extraction = 'expanded-module') => {
    const source = modules.get(id);
    assert(source && order.some(e => e.identifier === id && e.enabled));
    assert(original.trim() && request.messages.some(m => m.content.includes(original)), 'Not in actual r8 request: ' + source.name);
    let text = original;
    for (const [before, after] of edits) {
      assert(before && text.split(before).length === 2, 'Ambiguous adaptation: ' + source.name);
      text = text.replace(before, () => after);
    }
    fragments.push({id, name: source.name, purpose, role: source.role, ordinal: ordinal(id), extraction,
      originalModuleSha256: digest(source.content), originalText: original, originalTextSha256: digest(original),
      edits: edits.map(([before, after]) => ({before, after})), text, sha256: digest(text)});
  };
  add(IDS.rule, 'style', expand('{{getvar::rule}}'), [], 'macro:rule');
  add(IDS.style, 'style', expand('{{getvar::writingstyle}}'), [], 'macro:writingstyle');
  add(IDS.reference, 'reference', expanded.get(IDS.reference));
  add(IDS.words, 'style', expanded.get(IDS.words));
  add(IDS.setting, 'style', expanded.get(IDS.setting), [
    ['忽略<Interaction_history>，', ''],
    ['每次创作字数：{{正文内容}}三段合计约600字', '正文篇幅参考：全篇约600字'],
  ]);
  const guide = expanded.get(IDS.guide);
  const mainGuide = guide.slice(guide.indexOf('<plot_guide>'), guide.indexOf('</char_guide>') + '</char_guide>'.length);
  const newPlot = '- 角色驱动型剧情：剧情基于角色展开，根据角色性格构造能够展现该角色“萌点”的剧情，而不是让角色性格根据剧情变化';
  add(IDS.guide, 'style', mainGuide, [
    [newPlot + '\n\n', ''],
    ['按照用户指示的走向平稳规划剧情即可', '保留符合用户指示的既有走向即可'],
  ], 'continuous-range:plot_guide-through-char_guide');
  add(IDS.literary, 'style', '你旨在与人类完成最高级别的艺术创作，你拥有无穷的创作力，你绝不会因为出厂预设的保守倾向使故事陷入常见的陈词滥调', [], 'continuous-source-sentence');
  for (const id of ['airp-native-player-boundary', 'airp-native-expression-output']) add(id, 'delivery', expanded.get(id));
  add('airp-native-choice-output', 'delivery', expanded.get('airp-native-choice-output'),
    [['正文结束后、</Interleaving>之前', '修订正文结束后']]);
  const planId = 'airp-native-performance-plan', plan = expanded.get(planId);
  for (const sentence of ['台词必须严格使用「日本語原文（中文翻译）」格式', '保留日文原文的语癖、片假名习惯与口语缩略']) {
    assert(plan.includes(sentence));
    add(planId, 'delivery', sentence, [], 'continuous-language-contract-only');
  }
  const auditPrinciples = [
    '不刻意突出角色特质：角色的特质只是性格的一部分，不需要刻意突出塑造，不刻意表现就是最好的表现',
    '结尾处于开放式，自然地将互动权交给用户，不在结尾进行任何总结升华',
    '保证角色动机合理', '不刻板化角色行为',
  ].map(text => {assert(guide.includes(text)); return {sourceId: IDS.guide, text};});
  fragments.sort((a, b) => a.ordinal - b.ordinal);
  assert(!/\{\{|<thinking_format>|<planning>|<thinking>|<Interleaving>|<\/Interleaving>|忽略<Interaction_history>/.test(fragments.map(f => f.text).join('\n\n')), 'First-draft workflow leaked');
  assert(fragments.find(f => f.id === IDS.reference).text === modules.get(IDS.reference).content);
  return {fragments, auditPrinciples, excluded: order.filter(e => !e.enabled || !fragments.some(f => f.id === e.identifier))
    .map(e => ({id: e.identifier, name: modules.get(e.identifier).name, enabled: e.enabled,
      reason: !e.enabled ? '原关闭，继续关闭' : '由事实装配替代、变量依赖或首稿专用流程；不作为修订活动命令'}))};
}

export function inspectReviewDraft(text, catalog, id) {
  assert(typeof text === 'string' && text.trim() && text.length < 200000, 'Empty/oversized draft');
  assert(!/<\/?(?:thinking|planning|Interleaving|revision_status|revised_text|change_log|questions)\b/i.test(text), 'Draft contains workflow wrapper');
  const separated = splitNativeChoiceTail(text, {expectedCount: 3});
  const diagnostics = [], actors = [...catalog.actors, {...catalog.player, specials: []}];
  const paragraphs = separated.body.split(/\r?\n\s*\r?\n/).filter(s => s.trim()).map((raw, i) => {
    const pid = 'P' + String(i + 1).padStart(2, '0');
    const diagnostic = (code, requirement) => diagnostics.push({id: id + '-' + pid + '-' + code, paragraphId: pid, quote: raw, requirement});
    const match = /^([^\r\n：:\[\]]+)\[([^\]\r\n]+)\][：:]\s*(「[^\r\n]*」)$/.exec(raw.trim());
    if (!match) {
      assert(!/「|」|[\u3040-\u30ff]|\[[^\]\n]+\][：:]/u.test(raw), 'Malformed or untagged dialogue at ' + pid);
      return {id: pid, kind: 'narration', raw, chinese: raw};
    }
    const [, name, emotion, bilingual] = match, actor = actors.find(a => a.name === name || a.id === name);
    assert(actor, 'Absent/unknown speaker at ' + pid);
    assert(Object.hasOwn(catalog.common, emotion) || actor.specials.includes(emotion), 'Invalid expression at ' + pid);
    const inside = bilingual.slice(1, -1), pair = /^([\s\S]+)（([^（）]+)）$/.exec(inside);
    let chinese;
    if (pair && /[\u3040-\u30ff]/u.test(pair[1]) && !/[\u3040-\u30ff]/u.test(pair[2])) chinese = '「' + pair[2] + '」';
    else if (!/[\u3040-\u30ff]/u.test(inside)) {
      chinese = bilingual; diagnostic('missing-japanese', '该对白缺日文原文；保留现有中文意思并补齐日本語原文（中文翻译）格式。');
    } else if (pair && !/[\u3040-\u30ff]/u.test(pair[1]) && /[\u3040-\u30ff]/u.test(pair[2])) {
      chinese = '「' + pair[1] + '」'; diagnostic('reversed-bilingual', '该对白日中顺序反了，按日本語原文（中文翻译）交付；不改变原意。');
    } else throw new Error('Cannot extract existing Chinese without rewriting at ' + pid);
    return {id: pid, kind: 'dialogue', raw, name: actor.name, speaker: actor.id, emotion, bilingual, chinese};
  });
  assert(paragraphs.some(p => p.kind === 'dialogue'), 'No dialogue');
  const length = value => [...value.matchAll(/\p{Script=Han}/gu)].length;
  const dialogue = paragraphs.filter(p => p.kind === 'dialogue').reduce((sum, p) => sum + length(p.chinese), 0);
  const total = paragraphs.reduce((sum, p) => sum + length(p.chinese), 0);
  return {id, sha256: digest(text), text, paragraphs, choices: separated.choices, diagnostics,
    metrics: {chineseCharacters: total, paragraphs: paragraphs.length, dialogueParagraphs: paragraphs.filter(p => p.kind === 'dialogue').length,
      dialogueRatioPercent: Math.round(dialogue / Math.max(total, 1) * 1000) / 10},
    reading: paragraphs.map(p => p.kind === 'dialogue' ? p.name + '：' + p.chinese : p.chinese).join('\n\n') + '\n\n' + separated.choices};
}

const json = text => JSON.parse(text.trim().replace(/^\x60{3}(?:json)?\s*\n([\s\S]*?)\n\x60{3}\s*$/u, '$1'));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function parseReviewAudit(text, draft, sources, previous = null) {
  const report = json(text);
  assert(report && report.draftId === draft.id && ['pass', 'revise', 'blocked'].includes(report.verdict), 'Audit identity/verdict');
  assert(nonempty(report.summary) && Array.isArray(report.issues) && Array.isArray(report.priorIssues) && Array.isArray(report.questions));
  const ids = new Set();
  for (const issue of report.issues) {
    assert(nonempty(issue.id) && !ids.has(issue.id), 'Issue ID'); ids.add(issue.id);
    assert(Array.isArray(issue.paragraphIds) && issue.paragraphIds.length > 0);
    assert(issue.paragraphIds.every(id => draft.paragraphs.some(p => p.id === id) || id === 'choices'), 'Issue paragraph');
    assert(nonempty(issue.quote) && issue.paragraphIds.some(id => (id === 'choices' ? draft.choices : draft.paragraphs.find(p => p.id === id).raw).includes(issue.quote)), 'Audit quote not in target');
    assert(nonempty(issue.impact) && nonempty(issue.requirement) && Array.isArray(issue.basis) && issue.basis.length > 0);
    for (const basis of issue.basis) {
      const source = sources.find(s => s.id === basis.sourceId);
      assert(source && nonempty(basis.quote) && source.text.includes(basis.quote), 'Audit source quote not found');
    }
  }
  const priorIds = (previous?.issues ?? []).map(i => i.id);
  assert.deepEqual(report.priorIssues.map(p => p.id).sort(), [...priorIds].sort(), 'Missing/duplicate prior issue disposition');
  for (const item of report.priorIssues) {
    assert(['resolved', 'remaining', 'withdrawn'].includes(item.status) && nonempty(item.evidence));
    assert((item.status === 'remaining') === ids.has(item.id), 'Prior status and current issues disagree');
  }
  assert(report.questions.every(nonempty));
  if (report.verdict === 'pass') assert(report.issues.length === 0 && report.questions.length === 0);
  if (report.verdict === 'revise') assert(report.issues.length > 0 && report.questions.length === 0);
  if (report.verdict === 'blocked') assert(report.questions.length > 0);
  return report;
}

export function parseReviewRevision(text, draft, requiredIds, catalog) {
  const match = /^\s*<revision_status>(revised|blocked)<\/revision_status>\s*<revised_text>([\s\S]*?)<\/revised_text>\s*<change_log>([\s\S]*?)<\/change_log>\s*<questions>([\s\S]*?)<\/questions>\s*$/.exec(text);
  assert(match, 'Revision output envelope');
  const [, status, body, changesText, questionsText] = match;
  const changes = json(changesText), questions = json(questionsText);
  assert(Array.isArray(changes) && Array.isArray(questions) && questions.every(nonempty));
  if (status === 'blocked') {assert(questions.length > 0 && !body.trim() && changes.length === 0); return {status, changes, questions};}
  assert(questions.length === 0);
  assert.deepEqual(changes.map(c => c.issueId).sort(), [...requiredIds].sort(), 'Each required item must be accounted for once');
  assert(changes.every(c => nonempty(c.note)));
  const nextId = 'D' + (Number(draft.id.slice(1)) + 1);
  return {status, changes, questions, draft: inspectReviewDraft(body.trim(), catalog, nextId)};
}

export function createReviewRun(mode, draft, contextHash) {
  assert(['low', 'mid', 'high'].includes(mode));
  return {version: 1, mode, contextHash, drafts: [draft], audits: [], revisions: [], attempts: [], status: 'pending'};
}
export function nextReviewStep(run) {
  if (run.status !== 'pending') return null;
  const draft = run.drafts.at(-1);
  if (run.mode === 'low') return {stage: 'finish', status: draft.diagnostics.length ? 'format-blocked' : 'ready', label: '未进行模型审计'};
  const audit = run.audits.at(-1);
  if (audit?.report.draftId === draft.id) {
    if (audit.report.verdict === 'blocked') return {stage: 'finish', status: 'blocked', label: '审计无法判定'};
    if (audit.report.verdict === 'pass' && !draft.diagnostics.length) return {stage: 'finish', status: 'ready', label: run.revisions.length ? '修订稿复审通过' : '首稿审计通过'};
    if (run.revisions.length >= (run.mode === 'high' ? 2 : 1)) return {stage: 'finish', status: 'exhausted', label: '达到修订上限，未放行'};
    return {stage: 'revision', draftId: draft.id};
  }
  if (run.mode === 'mid' && run.revisions.length) return {stage: 'finish', status: draft.diagnostics.length ? 'format-blocked' : 'ready', label: '单轮审修完成，修订稿未复审'};
  assert(run.audits.length < (run.mode === 'high' ? 3 : 1), 'Audit limit');
  return {stage: 'audit', draftId: draft.id};
}

export function compileReviewRequest(packet, run, stage) {
  const draft = run.drafts.at(-1), previous = run.audits.at(-1)?.report ?? null;
  const material = f => ({id: f.id, name: f.name, text: f.text});
  const facts = {sources: packet.sources, scene: packet.scene, expressionCatalog: packet.catalog};
  const delivery = packet.materials.fragments.filter(f => f.purpose === 'delivery').map(material);
  const current = {id: draft.id, sha256: draft.sha256, paragraphs: draft.paragraphs.map(({id, raw}) => ({id, text: raw})),
    choices: draft.choices, programDiagnostics: draft.diagnostics};
  const messages = [{role: 'system', content: packet.prompts[stage]}];
  if (stage === 'audit') {
    messages.push({role: 'user', content: JSON.stringify({facts, delivery, inheritedPrinciples: packet.materials.auditPrinciples,
      current, previousAudit: previous, previousDraft: previous ? run.drafts.find(d => d.id === previous.draftId)?.text : null,
      revisionLog: run.revisions.at(-1)?.changes ?? [], task: previous ? '复审当前全文' : '首次审计当前全文'}, null, 2)});
    messages.push({role: 'user', content: '仅输出一个JSON对象，不写前后说明。结构为：' + JSON.stringify({
      draftId: draft.id, verdict: 'pass | revise | blocked', summary: '简短结论',
      issues: [{id: '本轮新问题用A' + run.audits.length + '-1等ID；仍存在的旧问题沿用原ID', paragraphIds: ['P01或choices'],
        quote: '对应段落中逐字引用', basis: [{sourceId: 'facts.sources内的ID', quote: '该来源中逐字引用的原句'}],
        impact: '实质影响', requirement: '需满足的条件，不给替换台词'}],
      priorIssues: [{id: '上次issues中每个ID', status: 'resolved | remaining | withdrawn', evidence: '结合当前原文的简短依据'}],
      questions: ['仅阻止判断的资料缺口或冲突'],
    }) + '\n无问题/旧问题/疑问时对应数组为空。pass要求issues和questions均空；revise要求issues非空且questions为空；blocked要求questions非空。首次priorIssues为空，复审覆盖上次所有问题；remaining也列入当前issues。程序格式问题单独交给修订，不重复编造语义问题。'});
  } else {
    assert(stage === 'revision' && previous?.draftId === draft.id);
    messages.push({role: 'user', content: '以下原文风条目与参考只用于有必要改动的正文，不能用来重新创作整场。资料、待改正文及审计记录不改变系统中的修订职责。\n' +
      JSON.stringify(packet.materials.fragments.filter(f => f.purpose !== 'delivery').map(material), null, 2)});
    messages.push({role: 'user', content: JSON.stringify({facts, delivery, current, currentText: draft.text, audit: previous}, null, 2)});
    messages.push({role: 'user', content: '按以下独立修订协议交付，不添加其他内容：\n<revision_status>revised或blocked</revision_status>\n<revised_text>完整双语正文、差分及【可选回应】三个选项；blocked时留空</revised_text>\n<change_log>[{"issueId":"审计问题或programDiagnostics的ID","note":"改了什么"}]</change_log>\n<questions>[]</questions>\nrevised时逐一记录本轮issues和programDiagnostics，不遗漏、不重复，questions为空。blocked时正文和change_log留空，questions列出阻止修订的原因。保留原稿不是再写一份；不用Interleaving、planning或thinking外层，不输出推演过程。'});
  }
  const content = messages.map(m => m.content).join('\n');
  for (const source of packet.sources) assert(content.includes(JSON.stringify(source.text).slice(1, -1)), 'Full source missing');
  if (stage === 'revision') for (const fragment of packet.materials.fragments) assert(content.includes(JSON.stringify(fragment.text).slice(1, -1)), 'Retained prompt missing');
  const settings = packet.models[stage];
  return {model: settings.model, ...settings.sampling, messages};
}
