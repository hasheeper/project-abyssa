// Isolated original-preset baseline, not the formal game pipeline. Never reads/writes saves.
// Prepare: node scripts/assess-airp-native-gemini.mjs --prepare
// Send once: node scripts/assess-airp-native-gemini.mjs --live <prepared-directory> <expected-calls>
// Reading copy, no API: node scripts/assess-airp-native-gemini.mjs --read <completed-directory>
// Additive Plan comparison, no API: node scripts/assess-airp-native-gemini.mjs --with-plan <baseline-directory>
// Existing-module micro-edits, no API: node scripts/assess-airp-native-gemini.mjs --with-micro <plan-directory>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync, renameSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';
import {compileNativeOrder, strictTextMessages, readVisibleResponse, originalBody, performancePlanBody, withPerformancePlan, chineseReadingBody, splitNativeChoiceTail, applyNativeMicroEdits, digest} from './lib/airp-native-baseline.mjs';
import {nativeExpressionCatalog, nativeExpressionPrompt, readNativeExpressionBody} from './lib/airp-native-expressions.mjs';

const root = process.cwd(), mode = process.argv[2];
const expressionVariant = 'original-sentence-micro-edits-r8-style-expressions';
const scene = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/airp-native-scene.json'), 'utf8'));
assert(mode === '--prepare' && process.argv.length === 3 || mode === '--live' && process.argv.length === 5 && /^\d+$/.test(process.argv[4]) || ['--read', '--with-plan', '--with-micro'].includes(mode) && process.argv.length === 4);
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let directory, sanitize = () => '[details withheld]';
try {
  const {parseTestConfig} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/test-config.ts');
  const {completionUrl} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  // Authentication is runtime-only. No private config content, endpoint or headers are logged.
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8');
  const config = parseTestConfig(privateText), markers = privateMarkers(JSON.parse(privateText));
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    assert(!markers.keys.some(k => text.includes(k)), 'Credential detected; refusing archive');
    for (const endpoint of [...markers.endpoints].sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]');
    return text;
  };
  assert.equal(config.models.writing.model, 'gemini-3.8-flash', 'Writing model changed; inspect before sending');
  assert(config.keys.writing && config.models.writing.baseUrl, 'Missing private writing connection');
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
  if (mode === '--prepare') {
    const {parsePreset, createMacroCompiler} = await vite.ssrLoadModule('/src/game-application/airp-generation/preset.ts');
    const {activatedDirectorDocuments} = await vite.ssrLoadModule('/src/content/presentation/airp/director-documents.ts');
    const {selectSceneSources} = await vite.ssrLoadModule('/src/game-application/airp-generation/source-selection.ts');
    const presetPath = '/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json';
    const originalText = await fs.readFile(presetPath, 'utf8'), original = JSON.parse(originalText);
    const snapshot = JSON.parse(await fs.readFile(path.join(root, 'src/content/presentation/airp/kemini-source.json'), 'utf8'));
    assert.equal(digest(originalText), snapshot.sha256, 'Original preset file changed');
    const preset = parsePreset(originalText, 'Kemini_Dramatron_v3.1 original');
    const {scenario, userInput} = scene;
    const sources = activatedDirectorDocuments.filter(s => ['world', 'character', 'player'].includes(s.kind));
    const selected = selectSceneSources(sources, scene.actors, scenario, userInput);
    for (const source of selected.full) {
      assert.equal(source.text, await fs.readFile(path.join(root, source.path), 'utf8'), `Changed source: ${source.id}`);
      assert.equal(digest(source.text), source.sha256, `Source digest mismatch: ${source.id}`);
    }
    const world = selected.full.filter(s => s.kind === 'world').map(s => s.text).join('\n\n');
    const persona = selected.full.find(s => s.kind === 'player').text;
    const description = selected.full.filter(s => s.kind === 'character').map(s => s.text).join('\n\n') +
      '\n\n【其他角色资料；本场不在场】\n' + selected.briefs.map(s => s.text).join('\n\n');
    const message = content => [{role: 'system', content}];
    const slots = {
      agentSystemPrompt: [], agentTask: [], agentResults: [],
      worldInfoBefore: message(world), worldInfoAfter: [], personaDescription: message(persona),
      charDescription: message(description), charPersonality: [], scenario: message(scenario), dialogueExamples: [],
      chatHistory: [{role: 'user', content: userInput}],
    };
    const values = {user: '凯尔', char: '艾洛拉', world, persona, description, personality: '', scenario, examples: '', history: userInput,
      '思考内容': '{{思考内容}}', '正文内容': '{{正文内容}}', '可能要求的附加内容': '{{可能要求的附加内容}}'};
    const compiled = compileNativeOrder(preset, '100001', createMacroCompiler(values), slots);
    assert.equal(compiled.trace.length, 30);
    for (const row of compiled.trace) assert.equal(row.originalSha256, digest(original.prompts.find(p => p.identifier === row.id).content ?? ''));
    const messages = strictTextMessages(compiled.messages);
    assert.equal(messages.map(m => m.content).join('\n\n'), compiled.messages.map(m => m.content).join('\n\n'), 'Postprocessing lost/reordered content');
    for (const source of selected.full) assert(messages.some(m => m.content.includes(source.text)), `Full source missing: ${source.id}`);
    const request = {model: config.models.writing.model, messages, stream: original.stream_openai,
      temperature: original.temperature, top_p: original.top_p, max_tokens: original.openai_max_tokens,
      frequency_penalty: original.frequency_penalty, presence_penalty: original.presence_penalty,
      reasoning_effort: original.reasoning_effort, n: original.n};
    assert.equal(request.stream, true); assert.equal(request.max_tokens, 65535);
    assert.equal(request.temperature, 1); assert.equal(request.top_p, 1);
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-native-gemini-')); await fs.chmod(directory, 0o700);
    await save('request.json', request);
    await save('before-postprocessing.json', compiled.messages);
    await save('preset-modules.json', compiled.trace.map(row => ({...row, originalContent: original.prompts.find(p => p.identifier === row.id).content ?? ''})));
    const manifest = {mode: 'native-gemini-baseline-only', presetPath, presetSha256: digest(originalText), orderId: '100001',
      scenario, userInput, presentActors: scene.actors, player: scene.player, playerName: '凯尔（原角色卡姓名；不代入旧测试别名）',
      endpoint: '[configured-endpoint]', timeoutMs: config.models.writing.timeoutMs,
      requestSha256: digest(sanitize(request)), enabledEntries: compiled.trace.length,
      beforeMessages: compiled.messages.length, afterMessages: messages.length, afterRoles: messages.map(m => m.role),
      fullSources: selected.full.map(({id, path, sha256, text}) => ({id, path, sha256, characters: text.length})),
      absentBriefs: selected.briefs, selectionDiagnostics: selected.diagnostics,
      slots: Object.fromEntries(Object.entries(slots).map(([id, contents]) => [id, {messages: contents.length, characters: contents.reduce((n, m) => n + m.content.length, 0)}])),
      transport: 'Chat Completions; streaming; strict no-tools text postprocessing',
      differences: [
        '不是实际酒馆运行：不执行伴生扩展、UI、脚本、正则或其他插件；无 assistant prefill。',
        '原预设全部30个启用项按原顺序编译；原文只作 setvar/getvar/trim/comment 机械展开，不拆分或改写。',
        '严格后处理来自当前 SillyTavern release 的纯文本 mergeMessages 规则；未验证用户酒馆版本。',
        'worldInfoBefore=基础及按本场文本命中的世界资料全文；worldInfoAfter为空，不重复。',
        '在场艾洛拉整卡、原玩家整卡；缺席者仅原卡三个字段简稿。原卡内性格和例句保持完整，不重复插入。',
        '没有原酒馆聊天记录；只放本次自然场景与一条用户行动，不放GM未来分支、Sol大纲、额外玩家约束、双语或AVG提示词。',
        'agentSystemPrompt/agentTask/agentResults没有宿主内容，绑定为空。',
        '保留原采样1/1、max_tokens=65535、reasoning_effort=low、流式及零惩罚；top_k=0、repetition_penalty=1、seed=-1未映射为非标准OAI字段。',
        '公开返回中的创作记录按原文保存；不获取/归档供应商私有推理字段。',
        '只测试单次生成能力，不是正式游戏接入、CORS或浏览器验收。',
      ]};
    await save('manifest.json', manifest);
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'prepared', directory, enabledEntries: manifest.enabledEntries, fullSources: manifest.fullSources.map(s => s.id),
      beforeMessages: manifest.beforeMessages, afterRoles: manifest.afterRoles, requestBytes: Buffer.byteLength(JSON.stringify(request)), model: request.model, max_tokens: request.max_tokens}));
  } else if (mode === '--with-plan') {
    const parentDirectory = path.resolve(process.argv[3]);
    assert.equal(path.dirname(parentDirectory), path.join(root, 'dist/reports'));
    assert(path.basename(parentDirectory).startsWith('airp-native-gemini-'));
    const baseline = JSON.parse(await fs.readFile(path.join(parentDirectory, 'manifest.json'), 'utf8'));
    assert.equal(baseline.mode, 'native-gemini-baseline-only');
    const parentText = await fs.readFile(path.join(parentDirectory, 'request.json'), 'utf8');
    assert.equal(digest(parentText), baseline.requestSha256);
    const additionPath = 'scripts/fixtures/airp-native-performance-plan.txt';
    const addition = await fs.readFile(path.join(root, additionPath), 'utf8');
    const request = withPerformancePlan(JSON.parse(parentText), addition);
    const before = JSON.parse(await fs.readFile(path.join(parentDirectory, 'before-postprocessing.json'), 'utf8'));
    before.push({role: 'user', content: addition});
    assert.deepEqual(strictTextMessages(before), request.messages);
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-native-gemini-plan-')); await fs.chmod(directory, 0o700);
    const {differences: baselineDifferences, ...inherited} = baseline;
    const manifest = {...inherited, mode: 'native-gemini-performance-plan', parentDirectory,
      parentRequestSha256: baseline.requestSha256, additionPath, additionSha256: digest(addition),
      requestSha256: digest(sanitize(request)), beforeMessages: before.length, afterMessages: request.messages.length,
      afterRoles: request.messages.map(m => m.role), baselineDifferences,
      differences: ['原基线所有参数、资料、场景和已有消息逐字不变；仅在最后的user消息追加独立的角色演出Plan与日中双语块。',
        'Plan只做一次；原ICOT三段继续由同一个Gemini执行。没有Sol、DeepSeek、表情标签或AVG限制。',
        '双语属于用户原Plan的语言协议；这次是Plan＋双语联合对照，不能分别归因。阅读稿只复制已有中文译文。']};
    await save('request.json', request); await save('before-postprocessing.json', before);
    await save('addition.txt', addition); await save('manifest.json', manifest);
    await save('preset-modules.json', await fs.readFile(path.join(parentDirectory, 'preset-modules.json'), 'utf8'));
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'prepared-plan-comparison', directory, parentDirectory, requestBytes: Buffer.byteLength(JSON.stringify(request)),
      model: request.model, max_tokens: request.max_tokens, afterRoles: manifest.afterRoles, additionSha256: manifest.additionSha256}));
  } else if (mode === '--with-micro') {
    const parentDirectory = path.resolve(process.argv[3]);
    const validReport = folder => {
      assert.equal(path.dirname(folder), path.join(root, 'dist/reports'));
      assert(path.basename(folder).startsWith('airp-native-gemini-'));
    };
    validReport(parentDirectory);
    const read = (folder, name) => fs.readFile(path.join(folder, name), 'utf8');
    const parent = JSON.parse(await read(parentDirectory, 'manifest.json'));
    assert.equal(parent.mode, 'native-gemini-performance-plan'); assert(!parent.microEdits, 'Use the original Plan comparison');
    const baselineDirectory = parent.parentDirectory; validReport(baselineDirectory);
    const baseline = JSON.parse(await read(baselineDirectory, 'manifest.json'));
    assert.equal(baseline.mode, 'native-gemini-baseline-only');
    const parentText = await read(parentDirectory, 'request.json'); assert.equal(digest(parentText), parent.requestSha256);
    const baseText = await read(baselineDirectory, 'request.json'); assert.equal(digest(baseText), baseline.requestSha256);
    const originalText = await fs.readFile('/Users/liuhang/Downloads/Kemini_Dramatron_v3.1.json', 'utf8');
    assert.equal(digest(originalText), baseline.presetSha256);
    const original = JSON.parse(originalText);
    const addition = await read(parentDirectory, 'addition.txt'); assert.equal(digest(addition), parent.additionSha256);
    const originalBefore = JSON.parse(await read(baselineDirectory, 'before-postprocessing.json'));
    const trace = JSON.parse(await read(baselineDirectory, 'preset-modules.json'));
    const slots = Object.fromEntries(trace.filter(t => t.marker).map(t => [t.id, t.messageIndices.map(i => originalBefore[i])]));
    const {parsePreset, createMacroCompiler} = await vite.ssrLoadModule('/src/game-application/airp-generation/preset.ts');
    const values = {'思考内容': '{{思考内容}}', '正文内容': '{{正文内容}}', '可能要求的附加内容': '{{可能要求的附加内容}}'};
    const compile = raw => compileNativeOrder(parsePreset(JSON.stringify(raw)), baseline.orderId, createMacroCompiler(values), slots);
    assert.deepEqual(compile(original).messages, originalBefore, 'Cannot reconstruct the frozen native baseline');
    assert.deepEqual(strictTextMessages(originalBefore), JSON.parse(baseText).messages);
    const microEdits = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/airp-native-micro-edits.json'), 'utf8'));
    const edited = applyNativeMicroEdits(original, microEdits);
    // Legacy frozen reports predate explicit cast metadata; use only this exact authored fixture.
    assert.equal(baseline.scenario, scene.scenario, 'Frozen scenario differs from expression cast fixture');
    assert.equal(baseline.userInput, scene.userInput, 'Frozen player input differs from expression cast fixture');
    if (baseline.presentActors) assert.deepEqual(baseline.presentActors, scene.actors);
    if (baseline.player) assert.deepEqual(baseline.player, scene.player);
    const {EMOTION_LABELS} = await vite.ssrLoadModule('/src/shared/domain/presentation/emotion.ts');
    const {CHARACTER_EMOTION_PROFILES} = await vite.ssrLoadModule('/src/content/presentation/character-emotions.ts');
    const {CHARACTER_EXPRESSIONS} = await vite.ssrLoadModule('/src/shared/ui/patterns/expressions.ts');
    const expressionCatalog = nativeExpressionCatalog({labels: EMOTION_LABELS, profiles: CHARACTER_EMOTION_PROFILES,
      recipes: CHARACTER_EXPRESSIONS, actors: scene.actors, player: scene.player});
    const closingRules = await Promise.all([
      {identifier: 'airp-native-expression-output', name: 'AVG差分（本场目录）', path: 'scripts/fixtures/airp-native-expression-output.txt'},
      {identifier: 'airp-native-player-boundary', name: '叙事规则', path: 'scripts/fixtures/airp-native-player-boundary.txt'},
      {identifier: 'airp-native-choice-output', name: '选项输出规则', path: 'scripts/fixtures/airp-native-choice-output.txt'},
    ].map(async rule => {
      const template = await fs.readFile(path.join(root, rule.path), 'utf8');
      const content = rule.identifier === 'airp-native-expression-output' ? nativeExpressionPrompt(template, expressionCatalog) : template;
      assert(content.trim(), 'Missing closing rule');
      return {...rule, content, templateSha256: digest(template), sha256: digest(content)};
    }));
    const compiled = compile(edited), before = [...compiled.messages, {role: 'user', content: addition}, ...closingRules.map(rule => ({role: 'user', content: rule.content}))];
    const request = {...JSON.parse(parentText), messages: strictTextMessages(before)};
    const changedIds = [...new Set(microEdits.map(e => e.identifier))];
    for (let i = 0; i < original.prompts.length; i++) {
      if (!changedIds.includes(original.prompts[i].identifier)) assert.deepEqual(edited.prompts[i], original.prompts[i]);
    }
    assert.deepEqual(edited.prompt_order, original.prompt_order);
    for (const source of baseline.fullSources) {
      const sourceText = await fs.readFile(path.join(root, source.path), 'utf8');
      assert.equal(digest(sourceText), source.sha256, `Frozen source changed: ${source.id}`);
      assert(request.messages.some(message => message.content.includes(sourceText)), `Full source missing: ${source.id}`);
    }
    const exported = {name: 'Kemini v3.1 · 原句微调＋Plan', prompts: structuredClone(edited.prompts), prompt_order: structuredClone(edited.prompt_order)};
    for (const key of ['temperature', 'top_p', 'openai_max_tokens', 'frequency_penalty', 'presence_penalty', 'reasoning_effort', 'stream_openai', 'n', 'squash_system_messages', 'assistant_prefill']) {
      if (Object.hasOwn(original, key)) exported[key] = original[key];
    }
    exported.prompts.push({identifier: 'airp-native-performance-plan', name: '角色演出Plan与双语（原样保留）', role: 'user', content: addition, injection_position: 0});
    exported.prompt_order.find(o => String(o.character_id) === baseline.orderId).order.push({identifier: 'airp-native-performance-plan', enabled: true});
    for (const rule of closingRules) {
      exported.prompts.push({identifier: rule.identifier, name: rule.name, role: 'user', content: rule.content, injection_position: 0});
      exported.prompt_order.find(o => String(o.character_id) === baseline.orderId).order.push({identifier: rule.identifier, enabled: true});
    }
    assert.deepEqual(strictTextMessages(compile(exported).messages), request.messages, 'Exported preset differs from the prepared request');
    directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-native-gemini-micro-')); await fs.chmod(directory, 0o700);
    const {differences: parentDifferences, ...inherited} = parent;
    const manifest = {...inherited, variant: expressionVariant, parentDirectory, baselineDirectory,
      presentActors: scene.actors, player: scene.player, expressionCatalog,
      parentRequestSha256: parent.requestSha256, requestSha256: digest(sanitize(request)), microEdits, changedIds,
      closingRules: closingRules.map(({content, ...rule}) => rule), enabledEntries: compiled.trace.length + 1 + closingRules.length,
      beforeMessages: before.length, afterMessages: request.messages.length, afterRoles: request.messages.map(m => m.role),
      effectivePresetSha256: digest(sanitize(exported)), parentDifferences,
      differences: ['在r7基础上微调克制描写、原有作品参考、引语结构，正向强调通俗白描、画面与对话配合、明白顺口；三段正文约600字、全篇约20段、对白约50%不变，字数排除新增差分标记。',
        '独立追加轻量逐台词差分规则；14通用项与本场在场角色专属项来自现有目录，玩家仅通用标记。角色是否在场由冻结场景明确指定，不从命中资料推断。',
        '中文阅读稿仅复制已有译文、剥离演出标记；说话者与差分另存逐段记录，不猜测、不默认为neutral。独立选项规则与玩家边界规则逐字不变。',
        '保留ICOT、口述感、内心独白、tell don’t show、资料、原模块顺序、role、Plan与采样。',
        '导出JSON含全部原prompts、原order、已有Plan和末尾规则；不带酒馆扩展脚本、私有端点或认证配置。',
        '离线编译与预设导出，不代表已生成新稿或替换正式游戏管线。']};
    await save('request.json', request); await save('manifest.json', manifest); await save('before-postprocessing.json', before);
    await save('addition.txt', addition); await save('preset.json', exported); await save('micro-edits.json', microEdits);
    await save('expression-catalog.json', expressionCatalog);
    for (const rule of closingRules) await save(path.basename(rule.path), rule.content);
    await save('preset-modules.json', compiled.trace.map(t => ({...t,
      sourceSha256: digest(original.prompts.find(p => p.identifier === t.id).content ?? ''),
      effectiveContent: edited.prompts.find(p => p.identifier === t.id).content ?? ''})));
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({event: 'prepared-micro-edits', directory, edits: microEdits.length, changedIds,
      originalModuleCount: original.prompts.length, exportedModuleCount: exported.prompts.length, requestBytes: Buffer.byteLength(JSON.stringify(request))}));
  } else if (mode === '--read') {
    directory = path.resolve(process.argv[3]);
    assert.equal(path.dirname(directory), path.join(root, 'dist/reports'));
    assert(path.basename(directory).startsWith('airp-native-gemini-'));
    const raw = await fs.readFile(path.join(directory, 'gemini-raw.txt'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    const hasPlan = manifest.mode === 'native-gemini-performance-plan';
    const hasExpressions = manifest.variant === expressionVariant;
    const readingTitle = hasExpressions ? 'Gemini 白描文风＋AVG差分＋Plan' : manifest.variant === 'original-sentence-micro-edits-r7-avg-performance' ? 'Gemini 600字AVG演出衔接＋Plan' : manifest.variant === 'original-sentence-micro-edits-r6-400-short-units' ? 'Gemini 400字短段＋态度选项＋Plan' : manifest.variant === 'original-sentence-micro-edits-r5-avg-attitude-choices' ? 'Gemini AVG短旁白＋态度选项＋Plan' : manifest.variant === 'original-sentence-micro-edits-r4-split-rules' ? 'Gemini 600字＋独立选项＋Plan' : manifest.variant === 'original-sentence-micro-edits-r3-bounded-response' ? 'Gemini 600字＋有限代言＋Plan' : manifest.variant === 'original-sentence-micro-edits-r2-dialogue-flow' ? 'Gemini 连续对白微调＋Plan' : manifest.variant === 'original-sentence-micro-edits-r1' ? 'Gemini 原句微调＋Plan' : hasPlan ? 'Gemini 原预设＋Plan' : 'Gemini 原预设';
    let body, bilingual, choices = '', expressionLines;
    if (hasPlan) {
      const parsed = performancePlanBody(raw); bilingual = parsed.body;
      const {chineseDialogue} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
      const separated = splitNativeChoiceTail(bilingual, hasExpressions || ['original-sentence-micro-edits-r4-split-rules', 'original-sentence-micro-edits-r5-avg-attitude-choices', 'original-sentence-micro-edits-r6-400-short-units', 'original-sentence-micro-edits-r7-avg-performance'].includes(manifest.variant) ? {expectedCount: 3} : {}); choices = separated.choices;
      if (hasExpressions) {
        assert(manifest.expressionCatalog, 'Missing frozen expression catalog');
        const performed = readNativeExpressionBody(separated.body, chineseDialogue, manifest.expressionCatalog);
        body = performed.body; expressionLines = performed.lines;
        await save('expression-lines.json', expressionLines);
        await save('中文演出稿.md', `# ${readingTitle} · 差分核对稿\n\n演出标签供验收，游戏中文台词不包含标签。\n\n` + expressionLines.map(line => line.kind === 'dialogue' ? `${line.name}[${line.emotion}]：${line.text}` : line.text).join('\n\n') + (choices ? '\n\n' + choices : '') + '\n');
      } else body = chineseReadingBody(separated.body, chineseDialogue);
      await save('双语正文.md', `# ${readingTitle} · 双语正文原样\n\n` + bilingual + '\n');
      await save('plan-raw.txt', parsed.plan);
    } else body = originalBody(raw);
    const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim());
    const metrics = {rawSha256: digest(raw), rawCharacters: raw.length, bodyCharacters: body.length, optionalResponseCharacters: choices.length,
      paragraphs: paragraphs.length, dialogueParagraphs: paragraphs.filter(p => p.trim().startsWith('「')).length,
      dialogueCharacters: paragraphs.filter(p => p.trim().startsWith('「')).reduce((n, p) => n + p.trim().length, 0),
      narrationCharacters: paragraphs.filter(p => !p.trim().startsWith('「')).reduce((n, p) => n + p.trim().length, 0),
      ...(hasExpressions ? {taggedDialogueParagraphs: expressionLines.filter(line => line.kind === 'dialogue').length, expressionMetadataExcluded: true} : {}),
      method: hasExpressions ? 'Strip Plan/ICOT wrappers; validate per-speaker expression tags against the frozen in-scene catalog; copy existing Chinese translations. Keep all paragraph boundaries; save metadata separately. Exclude tags and optional responses from prose metrics. No rewriting or model call.' : hasPlan ? 'Strip Plan/ICOT wrappers; copy existing Chinese translations, keeping narration and paragraph boundaries. Optional responses are preserved separately and excluded from prose metrics. No rewriting or model call.' : 'Only strip outer Interleaving and three thinking blocks. No prose edits, sentence splitting, translation or model call.'};
    if (choices) await save('待选回应.md', `# ${readingTitle} · 尚未发生的待选回应\n\n` + choices + '\n');
    await save('正文阅读稿.md', `# ${readingTitle} · 中文阅读稿\n\n` + (hasExpressions ? '仅去除Plan、ICOT和演出标记，复制已有中文译文；旁白与段落不改，未经润色。\n\n' : hasPlan ? '仅去除Plan与ICOT记录、复制已有中文译文；旁白与段落不改，未经润色。\n\n' : '仅去除外层标签及三段公开创作记录；正文未删改、未润色。\n\n') + body + (choices ? '\n\n' + choices : '') + '\n');
    await save('reading-metrics.json', metrics);
    await save('完整输出.md', `# ${readingTitle} · 完整可见返回\n\n` + '原样保存；含公开创作记录，不含供应商私有推理字段。\n\n````text\n' + raw + '\n````\n');
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({directory, ...metrics}));
  } else {
    directory = path.resolve(process.argv[3]); const expected = Number(process.argv[4]);
    assert.equal(path.dirname(directory), path.join(root, 'dist/reports'));
    assert(path.basename(directory).startsWith('airp-native-gemini-'));
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    const requestText = await fs.readFile(path.join(directory, 'request.json'), 'utf8');
    assert.equal(digest(requestText), manifest.requestSha256, 'Prepared request changed');
    const request = JSON.parse(requestText); assert.equal(request.model, config.models.writing.model);
    const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
    const lock = await fs.open(`${ledgerPath}.native-lock`, 'wx', 0o600);
    let ledger;
    try {
      ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')); assert.equal(ledger.calls, expected);
      assert(ledger.calls < ledger.limit && ledger.limit <= 200, 'Call budget exhausted or changed');
      await fs.writeFile(path.join(directory, 'dispatch.json'), sanitize({startedAt: new Date().toISOString(), call: expected + 1}), {flag: 'wx', mode: 0o600});
      // Count before sending; never retry, reset historical count or refund an uncertain outcome.
      assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger);
      ledger.calls++;
      const pending = `${ledgerPath}.native-${process.pid}.tmp`;
      writeFileSync(pending, JSON.stringify(ledger), {mode: 0o600, flag: 'wx'}); renameSync(pending, ledgerPath);
    } finally {await lock.close(); await fs.unlink(`${ledgerPath}.native-lock`);}
    console.log(sanitize({event: 'dispatch', directory, model: request.model, calls: ledger.calls, limit: ledger.limit}));
    const result = {status: 'request-failed', calls: ledger.calls, limit: ledger.limit, startedAt: Date.now()};
    try {
      const response = await fetch(completionUrl(config.models.writing.baseUrl), {method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(config.models.writing.timeoutMs),
        headers: {'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${config.keys.writing}`}, body: requestText});
      result.httpStatus = response.status;
      if (!response.ok) {
        // Never archive arbitrary error responses (they may echo authentication).
        await response.body?.cancel(); result.status = 'http-error';
      } else {
        let lastProgress = Date.now();
        const completed = await readVisibleResponse(response, characters => {
          if (Date.now() - lastProgress > 20000) {console.log(JSON.stringify({event: 'receiving', visibleCharacters: characters})); lastProgress = Date.now();}
        });
        await save('gemini-raw.txt', completed.text);
        await save('visible-response.json', completed);
        Object.assign(result, {status: completed.finishReason === 'stop' && completed.text.trim() && !completed.refused && !completed.toolCalls ? 'completed' : 'incomplete',
          finishReason: completed.finishReason, usage: completed.usage, returnedModel: completed.model, visibleCharacters: completed.text.length});
        await save('完整输出.md', '# Gemini 原预设单模型基线 · 完整可见返回\n\n未经润色或格式化。包含模型按原预设公开输出的创作记录；不是供应商私有推理。\n\n' + completed.text + '\n');
      }
    } catch (error) {result.errorType = error.name;}
    result.endedAt = Date.now(); await save('result.json', result);
    await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
    console.log(sanitize({directory, ...result}));
    if (result.status !== 'completed') process.exitCode = 1;
  }
} catch (error) {console.error(sanitize({directory, error: error.message})); process.exitCode = 1;}
finally {await vite.close();}
