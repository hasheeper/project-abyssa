// Offline verification of a completed isolated CL-F report. Never calls a model.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { isDeepStrictEqual } from 'node:util';
import { compactReportArchive } from './lib/airp-report-archive.mjs';

assert(process.argv.length === 3 || process.argv.length === 4 && process.argv[3] === '--check-only', 'Use <CL-F report directory> [--check-only]');
const root = process.cwd(), directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(root, 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const meta = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  assert(meta.completed && meta.step === 'done', 'Report has not completed the real loop');
  let archive = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  assert(!Object.values(config.keys).filter(Boolean).some(key => archive.includes(key)), 'Credential found in report');
  const endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  endpoints.forEach((url, index) => { archive = archive.replaceAll(`[configured-endpoint:${index}]`, url); });
  const { readD5Archive } = await load('game-application/versions/d5-validate');
  const AIRP_GAME_CATALOG = meta.contentVersion === 24 ? (await load('game-runtime/shop-wave-context')).SHOP_AIRP_CATALOG : (await load('game-runtime/airp-game-context')).AIRP_GAME_CATALOG;
  const { D5_RUN_READERS } = await load('game-core/session/index');
  const { currentSettlementActors } = await load('game-application/airp-settlement/actor-context');
  const { lowCanonicalChinese } = await load('game-application/airp-low/output');
  const { compileSceneGM } = await load('game-application/airp-director/scene-gm');
  const r = readD5Archive(compactReportArchive(archive), AIRP_GAME_CATALOG, D5_RUN_READERS);
  const s = r.airpGame.settlement, event = r.airpDirector.events.find(e => e.id === meta.eventId);
  assert.equal(event.status, 'resolved'); assert.equal(event.delivery.status, 'confirmed');
  assert.equal(r.snapshot.run, null); assert(s.jobs.every(j => j.status === 'applied'));
  assert.equal(s.receipts.length, s.memories.length);
  const nodes = Object.values(r.airpGame.nodes).flatMap(l => l.jobs);
  const dialoguePhases = [];
  for (const job of r.airpDirector.jobs.filter(j => j.text && (j.lowContextVersion ?? 0) >= 11)) {
    assert(job.lowPhase && job.lowFidelity, 'Interactive scene lost its phase/fidelity record');
    const writing = job.attempts.find(a => a.stage === 'writing' && (a.status === 'succeeded' || a.id === job.lowRevalidatedWriting));
    const canonical = lowCanonicalChinese(writing.output, job.lowFrame);
    if (canonical) assert.deepEqual(job.text.lines, canonical, 'Displayed Chinese differs from the original draft');
    assert.equal(job.lowFidelity.mode, canonical ? 'canonical' : 'model-extracted');
    if (job.lowContextVersion >= 17) {
      const sources = r.airpDirector.materials[job.materialHash].resources.sources;
      const request = compileSceneGM(job, 'scene-evaluate', sources);
      assert(job.gmContext?.version === 1 && job.planning === null, 'Scene GM lost its independent global snapshot');
      for (const ref of job.gmContext.documents) {
        const source = sources.find(s => s.id === ref.id && s.sha256 === ref.sha256);
        assert(source && request.messages.some(m => m.content.includes(source.text)), 'Scene GM original source was trimmed');
      }
    }
    if (!job.lowPhase.complete && event.readSceneIds.includes(job.id)) {
      const next = r.airpDirector.jobs.find(j => j.scene?.eventId === job.scene.eventId && j.scene.role === job.scene.role && j.scene.actionIndex === job.scene.actionIndex && j.scene.occurrence === job.scene.occurrence && j.scene.dialogue?.turn === job.scene.dialogue.turn + 1);
      assert(next?.text && next.scene.previous.some(p => p.sceneId === job.id), 'Completed choice did not continue the same phase with its read history');
      assert.equal(next.scene.dialogue.selectedResponse, job.lowResponse.text);
    }
    dialoguePhases.push({role: job.scene.role, turn: job.scene.dialogue.turn, phase: job.lowPhase, fidelity: job.lowFidelity});
  }
  for (const j of nodes.filter(j => j.status === 'completed')) {
    assert.equal(j.reads.length, j.text.lines.length);
    assert(j.selected && s.receipts.some(receipt => receipt.taskId === j.settlementId));
  }
  const effective = r.facts.filter(f => !r.retractedFactIds.includes(f.id));
  const returned = effective.filter(f => f.kind === 'progression' && f.payload.type === 'expedition-settled').at(-1).payload.terminal;
  assert.equal(returned.outcome, 'extracted'); assert.equal(returned.deepestLayer, 3);
  assert(meta.history.some(h => h.deviation === 'early-extraction' && h.layer === 3));
  const nextDay = r.airpDirector.jobs.filter(j => j.kind === 'day').at(-1);
  assert(nextDay.acceptedEntries !== null && nextDay.planning.budget.day > meta.returnedAtDay);
  const input = nextDay.planning;
  assert(!input.tasks.some(t => t.id === event.id), 'Closed commission was reintroduced as an active task');
  assert(input.world.uniqueCompletedIds.includes(event.card.id));
  assert(input.world.themes.some(t => t.sourceId === event.id && t.untilPhase === event.endedPhase + 256));
  if (meta.contextVersion >= 19) {
    // Compare against the view frozen for this GM, not the raw immutable ledger
    // or any new correction emitted by the very day call being verified.
    const view = nextDay.gmContext?.memoryContext;
    assert(view, 'Next GM lost its effective memory view');
    for (const target of view.targets) {
      const value = input.memories.find(m => m.id === target.id);
      assert(value, 'Next GM lost an effective memory target');
      assert.deepEqual(JSON.parse(value.text), target.kind === 'thread' ? {unresolved: target.value} : target.value);
    }
    assert.deepEqual(input.memories.filter(m => m.id.startsWith('thread:')).map(m => m.id).sort(), view.targets.filter(t => t.kind === 'thread').map(t => t.id).sort());
  } else {
    for (const memory of s.memories) memory.points.forEach((_p, i) => assert(input.memories.some(m => m.id === `${memory.id}:${i}`), 'Next GM lost a committed memory'));
    assert.deepEqual(input.memories.filter(m => m.id.startsWith('thread:')).map(m => m.id).sort(), s.openThreads.map(t => t.id).sort());
  }
  const variables = JSON.parse(input.facts.find(f => f.id.startsWith('variables:')).text);
  assert.deepEqual(variables.affinity, s.state.affinity);
  assert.deepEqual(variables.actors, currentSettlementActors(s.state.actors, input.world.phase, effective));
  const assets = JSON.parse(input.facts.find(f => f.id === 'assets:current').text);
  assert.deepEqual(assets.owned, r.snapshot.campaign.loot.map(i => ({ instanceId: i.instanceId, resultId: i.resultId })));
  assert(!JSON.stringify(assets).includes('definitionId'), 'Unidentified item identity leaked to day GM');
  const instanceIds = assets.owned.map(i => i.instanceId);
  assert.equal(new Set(instanceIds).size, instanceIds.length);
  if (meta.appraisal?.after) {
    assert.equal(assets.owned.find(i => i.instanceId === meta.appraisal.instanceId).resultId, meta.appraisal.after);
    assert.equal(assets.trades.filter(t => t.kind === 'appraise' && t.instanceId === meta.appraisal.instanceId).length, 1);
    assert.equal(meta.appraisal.repeatRequest, 'no-extra-charge-or-item');
  }
  const fixtureJob = meta.dayPlanFixture ? r.airpDirector.jobs.find(j => j.kind === 'day') : null;
  if (fixtureJob) {
    assert(meta.history.some(h => h.fixedDayFixture === meta.dayPlanFixture && h.realGmEvidence === false));
    assert.equal(fixtureJob.attempts.length, 1);
    assert.equal(JSON.parse(fixtureJob.attempts[0].output).reason, '测试替身，不是真实模型证据');
  }
  const calls = [
    ...r.airpDirector.jobs.filter(j => j !== fixtureJob).flatMap(j => j.attempts.map(a => ({ family: 'director', role: j.scene?.role ?? j.kind, ...a }))),
    ...r.airpGame.gm.jobs.flatMap(j => j.attempts.map(a => ({ family: 'expedition-gm', ...a }))),
    ...nodes.flatMap(j => j.attempts.map(a => ({ family: 'node', node: j.node.id, ...a }))),
    ...s.jobs.flatMap(j => j.attempts.map(a => ({ family: 'settlement', ...a }))),
  ];
  assert.equal(calls.length, meta.calls, 'Call count differs from durable attempts');
  assert.equal(meta.history.filter(h => h.request).length, meta.calls, 'Transport count differs from durable attempts');
  for (const job of r.airpDirector.jobs.filter(j => j.kind === 'scene' && j.lowContextVersion >= 16)) {
    assert.deepEqual(job.attempts.filter(a => a.status === 'succeeded').map(a => a.stage), ['writing', 'formatting', 'scene-evaluate']);
    assert(!job.sceneGMPlan && !job.attempts.some(a => a.stage === 'scene-plan'), 'Hidden pre-writing GM returned');
  }
  const corrections = [...r.airpDirector.jobs.flatMap(j => j.memoryCorrections ?? []), ...r.airpGame.gm.jobs.flatMap(j => j.memoryCorrections ?? [])];
  const {recordMemoryContext} = await load('game-application/airp-memory/d5');
  const effectiveMemory = recordMemoryContext(r);
  const chars = text => [...text.replace(/\s/g, '')].length;
  const visibleChars = line => chars(line.speaker === 'narrator' ? line.text.replace(/^(?:narrator|旁白)[：:][\t ]*/gmi, '') : line.text);
  const metric = (id, text) => {
    const total = text.lines.reduce((n, l) => n + visibleChars(l), 0), dialogue = text.lines.filter(l => l.speaker !== 'narrator');
    return { id, lines: text.lines.length, dialogueLines: dialogue.length, visibleChars: total, dialoguePercent: Math.round(1000 * dialogue.reduce((n, l) => n + visibleChars(l), 0) / total) / 10,
      longestNarration: Math.max(0, ...text.lines.filter(l => l.speaker === 'narrator').map(visibleChars)) };
  };
  const nodeExtraction = nodes.filter(j => j.text).map(j => {
    const writing = j.attempts.find(a => a.stage === 'writing' && (a.status === 'succeeded' || a.id === j.writingRevalidation?.attemptId));
    const canonical = lowCanonicalChinese(writing.output, j.frame);
    const stripOuterQuotes = lines => lines.map(l => ({...l, text: /^「[\s\S]*」$/.test(l.text) ? l.text.slice(1, -1) : l.text}));
    return {node: j.node.id, canonicalAvailable: !!canonical, exact: canonical ? isDeepStrictEqual(canonical, j.text.lines) : null,
      sameExceptOuterQuotes: canonical ? isDeepStrictEqual(stripOuterQuotes(canonical), stripOuterQuotes(j.text.lines)) : null,
      readingWarnings: j.writingWarnings};
  });
  const summary = { classification: meta.classification, technicalReplay: 'passed', contentAcceptance: 'requires separate text review; see audit and original scenes', networkCallsForThisCheck: 0,
    contentVersion: r.contentRef.contentVersion, contextVersion: meta.contextVersion, fixtureCalls: fixtureJob?.attempts.length ?? 0,
    memoryCorrections: {records: corrections, diagnostics: effectiveMemory?.diagnostics ?? [], closed: effectiveMemory?.closed ?? []},
    globalInputs: [...r.airpDirector.jobs.filter(j => j.gmContext).map(j => ({kind: j.kind, role: j.scene?.role, context: j.gmContext})),
      ...r.airpGame.gm.jobs.flatMap(j => j.frames.filter(f => f.context.gmContext).map(f => ({kind: 'expedition', context: f.context.gmContext})))].map(({context, ...identity}) => ({...identity,
        sourceHead: context.sourceHead, originalDocuments: context.documents.length, memoryTargets: context.memoryContext?.targets.length ?? 0})),
    gameCalls: meta.calls, callsOutsideThisReport: meta.externalCalls ?? 0, cumulativeGameCalls: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0), reportedTokens: calls.reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    unknownUsageCalls: calls.filter(a => a.usage.totalTokens === null).length,
    successfulReportedTokens: calls.filter(a => a.status === 'succeeded').reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    failedReportedTokens: calls.filter(a => a.status !== 'succeeded').reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    usageByStage: [...new Set(calls.map(a => `${a.family}:${a.stage ?? 'settlement'}`))].map(stage => {
      const rows = calls.filter(a => `${a.family}:${a.stage ?? 'settlement'}` === stage);
      return { stage, calls: rows.length, inputTokens: rows.reduce((n, a) => n + (a.usage.inputTokens ?? 0), 0), outputTokens: rows.reduce((n, a) => n + (a.usage.outputTokens ?? 0), 0), elapsedMs: rows.reduce((n, a) => n + (a.endedAt - (a.at ?? a.startedAt)), 0) };
    }),
    failedAttempts: calls.filter(a => a.status !== 'succeeded').map(a => ({ family: a.family, role: a.role, node: a.node, stage: a.stage, status: a.status, error: a.error })),
    return: { outcome: returned.outcome, deepestLayer: returned.deepestLayer, returnedItems: returned.returnedLoot.length },
    event: { status: event.status, delivery: event.delivery.status }, dialoguePhases, nodeExtraction, appraisal: meta.appraisal,
    state: { affinity: variables.affinity, actors: variables.actors }, settlements: s.receipts.length,
    openThreads: s.openThreads.map(t => ({ id: t.id, text: t.text, kind: t.kind, scope: t.scope })),
    nextDay: { day: input.budget.day, memoryPoints: input.memories.filter(m => m.id.startsWith('memory:')).length, entries: nextDay.acceptedEntries.map(e => ({ kind: e.kind, title: e.card.title, parentId: e.parentId })) },
    metrics: [...r.airpDirector.jobs.filter(j => j.text).map(j => metric(j.scene.role, j.text)), ...nodes.filter(j => j.text).map(j => metric(j.node.id, j.text))],
  };
  if (!process.argv.includes('--check-only')) await fs.writeFile(path.join(directory, 'verification.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(String(error?.message ?? 'CL-F offline verification failed').split('\n')[0]); process.exitCode = 1;
} finally { await vite.close(); }
