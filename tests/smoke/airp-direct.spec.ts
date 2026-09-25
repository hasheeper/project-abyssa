import { expect, test } from '@playwright/test';
import { directPatrol, directReady, manualDirectCopy, newDirectGame, readDirectConversation, savedDirect } from './airp-direct-helpers';
import { openManorJournal } from './playable-helpers';
import { writingEnvelope } from '../../src/game-application/testing/airp-writing-fixture';

for (const outcome of ['extracted', 'cleared'] as const) test(`P2 mock HTTP ${outcome}: real new game, patrol, four stages, followup, refresh and no automatic calls`, async ({page}, info) => {
  page.setDefaultTimeout(60000);
  let calls = 0;
  const requests: any[] = [], errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://example.invalid/v1/chat/completions', async route => {
    const body = route.request().postDataJSON(); requests.push(body); calls++;
    let output: string;
    if (body.messages[0].content.includes('记录整理器')) {
      const input = JSON.parse(body.messages[1].content);
      output = JSON.stringify({summary: '艾洛拉留下了等待回应的邀请。', supports: [input.lines[0].id], flags: []});
    } else if (body.model === 'test-planning') output = '三段式模拟规划，严格使用本次实际巡守结果。';
    else if (body.model === 'test-writing') output = writingEnvelope('艾洛拉看向桌边。\n「よければ、この先のことも話しませんか。（您愿意的话，我们也聊聊接下来的事吧。）」');
    else output = JSON.stringify({creationRecord: '保留自然段原文。', lines: [
      {speaker: 'narrator', emotion: 'neutral', text: '艾洛拉看向桌边。'},
      {speaker: 'elora', emotion: 'smile', text: '「よければ、この先のことも話しませんか。（您愿意的话，我们也聊聊接下来的事吧。）」'},
    ]});
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({choices: [{message: {role: 'assistant', content: output}, finish_reason: 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 20, total_tokens: 120}})});
  });
  await newDirectGame(page);
  await page.screenshot({path: info.outputPath('mock-new-game-mansion.png')});
  await directPatrol(page, outcome);
  await page.getByText('API／模型／预设设置', {exact: true}).click();
  await page.getByLabel('公共 API 地址', {exact: true}).fill('https://example.invalid/v1');
  await page.getByLabel('公共 API Key', {exact: true}).fill('mock-private-key');
  await page.getByLabel('大纲模型 ID', {exact: true}).fill('test-planning');
  await page.getByLabel('正文模型 ID', {exact: true}).fill('test-writing');
  await page.getByLabel('格式化模型 ID', {exact: true}).fill('test-formatting');
  await page.getByText('API／模型／预设设置', {exact: true}).click();
  expect(calls).toBe(0);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source, {timeout: 120000}).toBe('browser-direct');
  expect(calls).toBe(3);
  expect((await savedDirect(page)).airpDirect!.tasks[0].context!.proof.outcome).toBe(outcome);
  expect((await savedDirect(page)).airpDirect!.memories).toEqual([]);
  await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
  await page.screenshot({path: info.outputPath('mock-return-dialogue.png')});
  await readDirectConversation(page);
  await page.getByRole('button', {name: '确认交付并整理记忆', exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.memories.length, {timeout: 60000}).toBe(1);
  expect(calls).toBe(4);
  await openManorJournal(page, '旧药箱的搭扣');
  await page.getByRole('button', {name: '再和艾洛拉聊聊药箱', exact: true}).click();
  await directReady(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[1].source, {timeout: 120000}).toBe('browser-direct');
  expect(calls).toBe(7);
  await readDirectConversation(page);
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.memories.length, {timeout: 60000}).toBe(2);
  const completed = await savedDirect(page);
  expect(calls).toBe(8); expect(JSON.stringify(completed)).not.toContain('mock-private-key');
  await page.reload(); await directReady(page);
  expect((await savedDirect(page)).airpDirect).toEqual(completed.airpDirect);
  expect(calls).toBe(8); expect(errors).toEqual([]);
  expect(requests[4].messages.some((m: any) => m.content.includes('艾洛拉看向桌边。'))).toBe(true);
  await manualDirectCopy(page); expect(calls).toBe(8);
});
