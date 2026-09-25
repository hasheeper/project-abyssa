import assert from 'node:assert/strict';

// Diagnostic copies only: never overwrite author files, presets or live configuration.
export function buildInputDiagnostic(run, mode) {
  assert(['tags', 'no-output-limit', 'without-preset', 'neutral-size-control', 'plain-task'].includes(mode));
  if (mode === 'plain-task') {
    const attempt = run.attempts.find(a => a.stage === 'planning');
    assert(attempt?.config.model);
    const content = '写三句咖啡馆里的日常对白。';
    return {
      request: { model: attempt.config.model, messages: [{ role: 'user', content }], stream: true },
      audit: { mode, inputBytes: Buffer.byteLength(content), sourceCount: 0, plainTaskOnly: true, productionPresetChanged: false, outputLimitOmitted: true },
    };
  }
  if (mode === 'neutral-size-control') {
    const baseline = buildInputDiagnostic(run, 'no-output-limit');
    const subjects = ['木桌', '书架', '花盆', '窗帘', '台灯', '水杯', '靠垫', '画框', '笔筒', '钟表', '书本'];
    const positions = ['窗边', '门旁', '架上', '桌面', '墙角', '房间中央', '地毯旁'];
    const observations = ['颜色柔和', '边缘平整', '摆放整齐', '表面干净', '线条清晰', '光影均匀', '形状规则', '大小适中', '纹理细致'];
    const sized = (target, role) => {
      const header = role === 'system' ? '这是接口长输入诊断。以下是中性物品观察记录；只按用户末尾指令返回简短确认。\n' : '以下是中性物品观察记录，末尾有测试指令。\n';
      const tail = role === 'system' ? '\n记录结束。' : '\n测试指令：只回复“长输入连接成功。”';
      let text = header, used = Buffer.byteLength(header + tail), index = 0;
      assert(used < target, 'Neutral control requires a full-size real request');
      while (used < target) {
        const line = `观察记录：${subjects[index % subjects.length]}位于${positions[Math.floor(index / subjects.length) % positions.length]}。它的${observations[Math.floor(index / (subjects.length * positions.length)) % observations.length]}。另有${subjects[(index * 3 + 2) % subjects.length]}，${observations[(index * 5 + 1) % observations.length]}。\n`;
        for (const char of line) {
          const size = Buffer.byteLength(char);
          if (used + size > target) break;
          text += char; used += size;
        }
        if (target - used < 3) break;
        index++;
      }
      return text + ' '.repeat(target - used) + tail;
    };
    const request = { ...baseline.request, messages: baseline.request.messages.map(m => ({ role: m.role, content: sized(Buffer.byteLength(m.content), m.role) })) };
    for (let i = 0; i < request.messages.length; i++) assert.equal(Buffer.byteLength(request.messages[i].content), Buffer.byteLength(baseline.request.messages[i].content));
    return { request, audit: {
      mode, originalInputBytes: baseline.audit.originalInputBytes, inputBytes: baseline.audit.inputBytes,
      matchedTo: 'no-output-limit', matchingMessageContentBytes: request.messages.map(m => Buffer.byteLength(m.content)),
      serializedRequestBytes: Buffer.byteLength(JSON.stringify(request)), baselineSerializedRequestBytes: Buffer.byteLength(JSON.stringify(baseline.request)),
      syntheticControlOnly: true, fullSourcesPreserved: false, sourceCount: 0,
      originalSourceFilesUnchanged: true, productionPresetChanged: false, outputLimitOmitted: true,
      limitation: 'Matches UTF-8 content bytes and roles, not exact model token counts or semantics.',
    } };
  }
  const attempt = run.attempts.find(a => a.stage === 'planning');
  assert(attempt);
  const original = attempt.input.messages;
  assert.equal(original.length, run.spec.resources.sources.length + 4);
  assert.deepEqual(original.slice(0, 3).map(m => m.role), ['system', 'system', 'user']);
  const start = '【Kemini 三段式规划核心：原文检查要求】\n';
  const end = '\n【AIRP 阶段适配与扩展：大纲】';
  let prefix = original[1].content;
  const dispatch = prefix.split('\n').filter(line => line.startsWith('在写作前，你通常需要进行周密的思考，'));
  assert.equal(dispatch.length, 1, 'Expected exactly one obsolete format-dispatch sentence');
  prefix = prefix.replace(dispatch[0] + '\n', '');
  assert.equal(prefix.split(start).length, 2);
  assert.equal(prefix.split(end).length, 2);
  prefix = prefix.replace(start, start + '<thinking_format>\n').replace(end, '\n</thinking_format>' + end);
  const docs = original.slice(3, -1).map(m => m.content);
  const task = original.at(-1).content;
  const format = '输入区块 info 是完整作者资料，interactive_input 是本场情境，interaction_history 是已读历史；Interaction_history 是该历史区块的兼容别名。以上区块只组织输入，不要求在输出中复刻标签。planning 的唯一交付物是第一段、第二段、第三段的可执行创作计划，不交错输出正文，不输出XML包裹或内部思考过程。';
  const system = mode === 'without-preset' ? `${original[0].content}\n\n${format}` : `${original[0].content}\n\n${prefix}\n\n${format}`;
  const user = `<interactive_input>\n${original[2].content}\n</interactive_input>\n\n<info>\n${docs.join('\n\n')}\n</info>\n\n<Interaction_history>\n<interaction_history>\n${run.spec.sample.memories.length ? '历史以本场情境的已读记忆字段为准。' : '本场没有已读历史，不补造过去。'}\n</interaction_history>\n</Interaction_history>\n\n${task}`;
  const request = { model: attempt.config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], stream: true };
  for (const name of ['max_tokens', 'temperature', 'top_p']) if (attempt.config[name] !== undefined && !(name === 'max_tokens' && mode !== 'tags')) request[name] = attempt.config[name];
  for (const source of run.spec.resources.sources) assert(user.includes(source.text), `Missing full source: ${source.path}`);
  const expected = ['info', 'interactive_input', 'interaction_history', 'Interaction_history', ...(mode === 'without-preset' ? [] : ['thinking_format'])];
  const lines = request.messages.flatMap(m => m.content.split('\n'));
  for (const tag of expected) {
    assert.equal(lines.filter(l => l === `<${tag}>`).length, 1, `Ambiguous definition ${tag}`);
    assert.equal(lines.filter(l => l === `</${tag}>`).length, 1, `Unclosed definition ${tag}`);
  }
  assert(!system.includes('<Interleaving>') && !system.includes('<thinking>'));
  return {
    request,
    audit: {
      mode, originalInputBytes: attempt.input.bytes,
      inputBytes: request.messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0),
      sourceCount: run.spec.resources.sources.length, fullSourcesPreserved: true,
      sourceHashes: run.spec.resources.sources.map(s => ({ path: s.path, sha256: s.sha256 })),
      removedFormatDispatch: dispatch[0], requiredInputBlocks: expected,
      productionPresetChanged: false, outputLimitOmitted: mode !== 'tags',
      presetOmittedForDiagnosticOnly: mode === 'without-preset',
    },
  };
}
