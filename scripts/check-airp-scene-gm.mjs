// Offline replay and text/authority checks for isolated, partial scene-GM reports.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { compactReportArchive } from './lib/airp-report-archive.mjs';

const flags = process.argv.slice(3);
assert(process.argv.length >= 3 && flags.every(f => ['--require-ready', '--check-only'].includes(f)), 'Use <CL-F report directory> [--require-ready] [--check-only]');
const root = process.cwd(), directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(root, 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false, ws: false, watch: null}, appType: 'custom'});
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const {parseTestConfig} = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const meta = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  let archive = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  const keys = Object.values(config.keys).filter(Boolean);
  assert(!keys.some(key => archive.includes(key)), 'Credential found in report');
  const endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  endpoints.forEach((url, i) => {archive = archive.replaceAll(`[configured-endpoint:${i}]`, url);});
  const {readD5Archive} = await load('game-application/versions/d5-validate');
  const catalog = (await load('game-runtime/shop-wave-context')).SHOP_AIRP_CATALOG;
  const {D5_RUN_READERS} = await load('game-core/session/index');
  const {compileSceneGM} = await load('game-application/airp-director/scene-gm');
  const {sceneContinuationGuide} = await load('game-application/airp-director/scene-gm-v18');
  const {compileLowRequest, lowCanonicalChinese} = await load('game-application/airp-low/output');
  const r = readD5Archive(compactReportArchive(archive), catalog, D5_RUN_READERS);
  const jobs = r.airpDirector.jobs.filter(j => j.kind === 'scene');
  assert(jobs.every(j => j.lowContextVersion >= 14), 'Only scene-GM reports');
  const event = r.airpDirector.events.find(e => e.id === meta.eventId);
  if (flags.includes('--require-ready')) {
    assert.equal(meta.step, 'expedition-plan');
    assert.equal(event.status, 'waiting-action');
    assert.notEqual(event.actionPhase, null);
    assert.equal(r.snapshot.run, null, 'GM must not automatically depart');
    assert(jobs.some(j => j.scene.role === 'acceptance' && j.sceneGMEvaluation?.complete) || meta.contextVersion >= 20 && event.narrativeSkips?.length,
      'Missing completed or GM-covered acceptance');
  }
  for (const skip of event.narrativeSkips ?? []) {
    const source = jobs.find(j => j.id === skip.sourceJobId);
    assert(source?.lowContextVersion >= 20 && source.sceneGMEvaluation?.complete && event.readSceneIds.includes(source.id));
    assert(source.sceneGMEvaluation.coveredAcceptance.some(c => c.choiceId === skip.choiceId && c.reason === skip.reason));
    assert(skip.basisSceneIds.every(id => event.readSceneIds.includes(id)));
    assert(event.selected.some(c => c.id === skip.choiceId && c.sourceId === skip.decisionFactId), 'Coverage executed without actual choice');
    assert(!jobs.some(j => j.scene.role === 'acceptance' && j.scene.actionIndex === source.scene.actionIndex && j.scene.occurrence === source.scene.occurrence), 'Covered acceptance still generated');
  }
  for (const job of jobs) {
    const combined = job.lowContextVersion >= 16;
    const sources = r.airpDirector.materials[job.materialHash].resources.sources;
    const input = combined ? job.text && compileSceneGM(job, 'scene-evaluate', sources) : compileSceneGM(job, 'scene-plan');
    if (input && job.lowContextVersion >= 17) {
      assert(job.gmContext?.version === 1, 'Missing frozen global GM snapshot');
      for (const ref of job.gmContext.documents) {
        const source = sources.find(s => s.id === ref.id && s.sha256 === ref.sha256);
        assert(source && input.messages.some(m => m.content.includes(source.text)), 'GM global original missing');
      }
      assert.equal(job.planning, null, 'Scene was disguised as a day plan');
    }
    if (input) for (const source of job.lowFrame.sources) assert(input.messages.some(m => m.content.includes(source.text)), 'GM source was trimmed');
    if (job.lowContextVersion >= 18) {
      if (input) assert.deepEqual(JSON.parse(input.messages[1].content).guidanceUsed, sceneContinuationGuide(job.scene.previousEvaluation?.next));
      assert(!job.lowFrame.scene.currentTurn.includes('taskGuide中的目标、地点、达成条件、交付对象须让玩家了解'), 'Recurring checklist returned');
      const guide = sceneContinuationGuide(job.scene.previousEvaluation?.next);
      if (guide) assert(job.lowFrame.scene.currentTurn.includes(JSON.stringify(guide)), 'Projected continuation guidance missing');
    }
    if (combined) {
      assert(!job.attempts.some(a => a.stage === 'scene-plan') && !job.sceneGMPlan, 'Pre-writing GM call returned');
      assert.equal(job.lowFrame.scene.pacing?.suggestedWords, job.scene.previousEvaluation?.next?.suggestedWords, 'Next guidance was not inherited');
      const succeeded = job.attempts.filter(a => a.status === 'succeeded').map(a => a.stage);
      assert.deepEqual(succeeded, ['writing', 'formatting', 'scene-evaluate'].slice(0, succeeded.length));
    }
    if (job.scene.previousEvaluation) {
      const prior = jobs.find(j => j.id === job.scene.previousEvaluation.sceneId);
      assert(prior && event.readSceneIds.includes(prior.id), 'Unread GM assessment used');
      assert.equal(prior.scene.role, job.scene.role, 'Assessment leaked across stages');
    }
    const writing = job.attempts.find(a => a.stage === 'writing' && a.status === 'succeeded');
    if (writing) {
      const request = compileLowRequest(job.lowFrame, writing.output, 6, 2);
      assert.equal(JSON.parse(request.messages[1].content).stageContext, undefined, 'Formatter regained stage authority');
      const canonical = lowCanonicalChinese(writing.output, job.lowFrame);
      if (canonical && job.text) assert.deepEqual(job.text.lines, canonical, 'Displayed Chinese differs from draft');
    }
    if (job.sceneGMEvaluation) {
      assert.equal(job.lowPhase.complete, job.sceneGMEvaluation.complete);
      assert(job.attempts.some(a => a.stage === 'scene-evaluate' && a.status === 'succeeded'));
      if (job.sceneGMEvaluation.complete) assert.deepEqual(job.lowChoices, []);
    }
  }
  const calls = jobs.flatMap(j => j.attempts);
  assert.equal(calls.length, meta.calls, 'Unexpected calls outside the scene test');
  const metric = job => {
    const lines = job.text?.lines ?? [], size = l => [...l.text.replace(/\s/g, '')].length;
    const chars = lines.reduce((n, l) => n + size(l), 0);
    return {role: job.scene.role, turn: job.scene.dialogue.turn, plan: job.sceneGMPlan, ...(job.lowContextVersion >= 16 ? {guidanceUsed: job.lowContextVersion >= 18 ? sceneContinuationGuide(job.scene.previousEvaluation?.next) : job.scene.previousEvaluation?.next ?? null} : {}), evaluation: job.sceneGMEvaluation,
      chars, lines: lines.length, dialoguePercent: chars ? Math.round(1000 * lines.filter(l => l.speaker !== 'narrator').reduce((n, l) => n + size(l), 0) / chars) / 10 : null,
      longestNarration: Math.max(0, ...lines.filter(l => l.speaker === 'narrator').map(size)), fidelity: job.lowFidelity};
  };
  const result = {contextVersion: meta.contextVersion, classification: meta.classification, technicalReplay: 'passed',
    networkCallsForThisCheck: 0, gameCalls: meta.calls, cumulative: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0),
    reportedTokens: calls.reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0), unknownUsageCalls: calls.filter(a => a.usage.totalTokens === null).length,
    event: {status: event.status, role: event.role, actionPhase: event.actionPhase, nextStep: meta.step, ...(event.narrativeSkips ? {narrativeSkips: event.narrativeSkips} : {})},
    failures: calls.filter(a => a.status === 'failed').map(a => ({stage: a.stage, error: a.error, code: a.diagnostics?.code, finishReason: a.diagnostics?.finishReason})),
    turns: jobs.map(metric), contentAcceptance: 'requires text review; no visual acceptance'};
  const output = JSON.stringify(result, null, 2);
  assert(![...keys, ...endpoints].some(secret => output.includes(secret)), 'Private marker in summary');
  if (!flags.includes('--check-only')) await fs.writeFile(path.join(directory, 'scene-gm-verification.json'), output + '\n', {mode: 0o600});
  console.log(output);
} catch {
  console.error('Scene-GM offline check failed; inspect the isolated report. Private details withheld.'); process.exitCode = 1;
} finally {await vite.close();}
