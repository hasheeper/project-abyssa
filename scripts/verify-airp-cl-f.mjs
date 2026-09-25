// Opt-in real-model CL-F, one inspectable phase per invocation. No browser or player saves.
// --step new|dist/reports/airp-cl-f-XXXXXX <expected-cumulative-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { readVisibleResponse } from './lib/airp-native-baseline.mjs';
import { verifiedWritingOverride } from './lib/airp-writing-override.mjs';
import { compactReportArchive } from './lib/airp-report-archive.mjs';

const flags = process.argv.slice(5);
// context20 is a new request version; retain every older report's frozen version.
const validationFlags = flags.filter(flag => flag !== '--context-version=20');
assert(process.argv[2] === '--step' && process.argv.length >= 5 && /^\d+$/.test(process.argv[4]) && validationFlags.every(flag => ['--revalidate-writing', '--settlement-max-tokens=32768', '--initialize-only', '--content-version=24', '--context-version=8', '--context-version=9', '--context-version=11', '--context-version=12', '--context-version=13', '--context-version=14', '--context-version=15', '--context-version=16', '--context-version=17', '--context-version=18', '--context-version=19', '--single-scene-turn', '--fixed-medicine-fixture', '--refresh-settlement', '--node-program-facts', '--capture-visible-stream', '--writing-model=deepseek-flash'].includes(flag)), 'Use --step new|<report-dir> <expected-cumulative-calls> [--context-version=8|9|11|12|13|14|15|16|17|18|19|20] [--single-scene-turn] [--content-version=24] [--fixed-medicine-fixture] [--revalidate-writing] [--settlement-max-tokens=32768] [--initialize-only] [--refresh-settlement] [--node-program-facts] [--capture-visible-stream] [--writing-model=deepseek-flash]');
assert(!flags.includes('--fixed-medicine-fixture') || process.argv[3] === 'new', 'A fixed-day fixture must start a separate, explicitly labelled report');
assert(!flags.includes('--initialize-only') || process.argv[3] === 'new', 'Initialization check requires a new isolated report');
assert(!flags.includes('--writing-model=deepseek-flash') || process.argv[3] !== 'new', 'Model diagnostic resumes an existing failed scene only');
const root = process.cwd(), expected = Number(process.argv[4]), ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
let directory, persist, recordFailure, sanitize = () => '[details withheld]', lockFile;
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    assert(!secrets.some(secret => text.includes(secret)), 'Credential detected; refuse to write report');
    endpoints.forEach((endpoint, i) => { text = text.replaceAll(endpoint, `[configured-endpoint:${i}]`); }); return text;
  };
  const rehydrate = text => endpoints.reduce((value, endpoint, i) => value.replaceAll(`[configured-endpoint:${i}]`, endpoint), text);
  const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  assert(ledger.calls === expected && expected < ledger.limit, 'Shared call budget changed/exhausted');
  lockFile = await fs.open(`${ledgerPath}.cl-f.lock`, 'wx', 0o600);
  const fresh = process.argv[3] === 'new';
  const existingDirectory = fresh ? null : path.resolve(root, process.argv[3]);
  if (existingDirectory) assert(path.dirname(existingDirectory) === path.join(root, 'dist/reports') && path.basename(existingDirectory).startsWith('airp-cl-f-'), 'Not a CL-F report directory');
  const priorMeta = fresh ? null : JSON.parse(await fs.readFile(path.join(existingDirectory, 'run.json'), 'utf8'));
  const writingOverride = flags.includes('--writing-model=deepseek-flash') ? await verifiedWritingOverride(config, 'deepseek-flash') : null;
  if (writingOverride) { config.models.writing = writingOverride.config; config.keys.writing = writingOverride.key; }
  const contentVersion = priorMeta?.contentVersion ?? (fresh && flags.includes('--content-version=24') ? 24 : 22);
  const contextVersion = priorMeta?.contextVersion ?? (fresh && flags.includes('--context-version=20') ? 20 : fresh && flags.includes('--context-version=19') ? 19 : fresh && flags.includes('--context-version=18') ? 18 : fresh && flags.includes('--context-version=17') ? 17 : fresh && flags.includes('--context-version=16') ? 16 : fresh && flags.includes('--context-version=15') ? 15 : fresh && flags.includes('--context-version=14') ? 14 : fresh && flags.includes('--context-version=13') ? 13 : fresh && flags.includes('--context-version=12') ? 12 : fresh && flags.includes('--context-version=11') ? 11 : fresh && flags.includes('--context-version=9') ? 9 : fresh && flags.includes('--context-version=8') ? 8 : 7), readerVersion = contextVersion >= 11 ? 6 : contextVersion >= 8 ? 5 : 4;
  assert(!flags.includes('--context-version=20') || contextVersion === 20, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=18') || contextVersion === 18, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=19') || contextVersion === 19, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=17') || contextVersion === 17, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=16') || contextVersion === 16, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=15') || contextVersion === 15, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=13') || contextVersion === 13, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=14') || contextVersion === 14, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=12') || contextVersion === 12, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=11') || contextVersion === 11, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=8') || contextVersion === 8, 'Do not change a historical report context');
  assert(!flags.includes('--context-version=9') || contextVersion === 9, 'Do not change a historical report context');
  assert(!flags.includes('--content-version=24') || contentVersion === 24, 'Do not migrate an existing content22 report');
  const AIRP_GAME_CATALOG = contentVersion === 24 ? (await load('game-runtime/shop-wave-context')).SHOP_AIRP_CATALOG : (await load('game-runtime/airp-game-context')).AIRP_GAME_CATALOG;
  const { MemoryGameDatabase, MemoryGameStore } = await load('game-infrastructure/storage/memory');
  const { createPlayerRuntime } = await load('game-runtime/player-runtime');
  const { createVersionedGameRuntime } = await load('game-runtime/versioned-runtime');
  const { sha256, canonicalJson } = await load('game-core/contracts/index');
  const { readD5Archive } = await load('game-application/versions/d5-validate');
  const { serializeD5Archive } = await load('game-application/versions/d5-archive');
  const { D5_RUN_READERS } = await load('game-core/session/index');
  const { airpGameView, pendingHomeBoundary } = await load('game-runtime/airp-game-runtime');
  const { directorView, directorStage } = await load('game-runtime/airp-director-view');
  const { createAiConfiguration, effectiveAiConfiguration } = await load('game-runtime/airp-configuration');
  const { activatedDirectorDocuments } = await load('content/presentation/airp/director-documents');
  const { lowR8Source } = await load('content/presentation/airp/low-r8-source');
  const { createDirectorDriver } = await load('game-runtime/airp-director-driver');
  const { createExpeditionGMDriver } = await load('game-runtime/airp-expedition-gm-driver');
  const { createNodeDriver } = await load('game-runtime/airp-expedition-play-driver');
  const { nodeStage } = await load('game-application/airp-expedition-play/service');
  const { createSettlementDriver } = await load('game-runtime/airp-settlement-driver');
  const { createDirectProvider } = await load('game-infrastructure/airp-direct/provider');
  const { createLowProvider } = await load('game-infrastructure/airp-direct/low-provider');
  const { nextD5PlayCommand } = await load('game-application/testing/d5-playthrough');
  // Pin this acceptance to its explicit content version, never migrate an old report.
  const database = new MemoryGameDatabase(), store = new MemoryGameStore(database);
  let serial = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `formal:${++serial}`, newSeed: () => 19, close() {} });
  const f = { database, runtime, raw: () => structuredClone(database.records.get('formal-airp')),
    departure: { runId: 'formal-run:1', routeId: AIRP_GAME_CATALOG.data.manor.maintenanceRouteId, partyIds: [...AIRP_GAME_CATALOG.data.initialParty], itemIds: ['item.food', 'item.potion'], seed: 19 } };
  const flow = runtime.airpGame.forSave('formal-airp', contentVersion);
  if (fresh) {
    const initial = createVersionedGameRuntime(store, [{ version: 4, catalog: AIRP_GAME_CATALOG }]);
    const request = { protocolVersion: 4, profileId: AIRP_GAME_CATALOG.data.journey.defaultProfileId, saveId: 'formal-airp', epoch: 'epoch:1', clientRequestId: 'create-formal' };
    const created = await initial.create({ contentRef: AIRP_GAME_CATALOG.ref, request }); assert(created.ok);
    const started = await initial.dispatch({ protocolVersion: 4, saveId: request.saveId, expectedHead: created.receipt.after,
      clientRequestId: `start:${sha256(canonicalJson(request)).slice(0, 32)}`, command: { type: 'select-game-start', startAt: 'airp-director' } });
    assert(started.ok && f.raw().contentRef.contentVersion === contentVersion);
  }
  directory = fresh ? await fs.mkdtemp(path.join(root, 'dist/reports/airp-cl-f-')) : path.resolve(root, process.argv[3]);
  assert(path.dirname(directory) === path.join(root, 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'), 'Not a CL-F report directory');
  await fs.chmod(directory, 0o700);
  const save = (name, data) => fs.writeFile(path.join(directory, name), sanitize(data), { mode: 0o600 });
  const meta = fresh ? { version: 1, contentVersion, contextVersion, classification: `formal-content${contentVersion}/${flags.includes('--fixed-medicine-fixture') ? 'fixed-day-fixture/real-scene-models' : 'real-models'}/real-engine/tester-actions/no-player-save/no-visual`, initialCalls: expected, calls: 0,
    dayPlanFixture: flags.includes('--fixed-medicine-fixture') ? 'ripple.elora.old-medicine-case' : null,
    callCeiling: Math.min(expected + 36, ledger.limit), step: 'day', eventId: null, commands: 0, completed: false, history: [], selectedAttitudes: [], deliberateDeviation: 'extract-after-layer-3' }
    : priorMeta;
  if (!fresh) {
    // Reports historically used pretty JSON. Restore the same compact archive
    // emitted by production; formatting whitespace must not consume its budget.
    const record = readD5Archive(compactReportArchive(rehydrate(await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8'))), AIRP_GAME_CATALOG, D5_RUN_READERS);
    f.database.records.set('formal-airp', record);
    const accounted = meta.initialCalls + meta.calls + (meta.externalCalls ?? 0);
    assert(expected >= accounted, 'Report is ahead of the shared budget; inspect interrupted accounting');
    if (expected > accounted) {
      meta.externalCalls = (meta.externalCalls ?? 0) + expected - accounted;
      meta.history.push({ callsOutsideThisReport: expected - accounted, cumulative: expected, at: Date.now() });
    }
  }
  const connection = slot => ({ config: config.models[slot], key: config.keys[slot] });
  const currentEvent = () => f.raw().airpDirector.events.find(e => e.id === meta.eventId);
  const currentJob = id => f.raw().airpDirector.jobs.find(j => j.id === id);
  persist = async () => { await save('formal-save.json', serializeD5Archive(f.raw())); await save('run.json', meta); };
  recordFailure = reason => meta.history.push({stoppedAt: Date.now(), step: meta.step, reason, revision: f.raw().head.revision});
  let lastRequest;
  const send = async command => {
    const request = { protocolVersion: 4, saveId: 'formal-airp', expectedHead: f.raw().head, clientRequestId: `cl-f:${randomUUID()}`, command };
    lastRequest = request;
    const result = await (command.type === 'resume-run' ? f.runtime.application.resumeEnemyTurn(request) : f.runtime.application.dispatch(request));
    assert(result.ok, sanitize({ command, error: result.error })); meta.commands++; return result;
  };
  const transport = async (...args) => {
    const before = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(before.calls === expected + stepCalls && before.calls < meta.callCeiling && before.calls < before.limit, 'Budget changed or phase ceiling reached');
    await fs.writeFile(ledgerPath, JSON.stringify({ ...before, calls: before.calls + 1 })); stepCalls++; meta.calls++;
    await persist();
    const payload = JSON.parse(args[1].body), startedAt = Date.now();
    // Exact public request body, without authorization headers or private endpoints.
    await save(`request-${before.calls + 1}.json`, payload);
    meta.history.push({ request: before.calls + 1, step: meta.step, model: payload.model, messageChars: payload.messages.reduce((n, m) => n + m.content.length, 0), messageCount: payload.messages.length, startedAt });
    console.log(sanitize({ event: 'cl-f-call', step: meta.step, cumulative: before.calls + 1, model: payload.model }));
    await persist();
    const response = await fetch(...args);
    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream') && flags.includes('--capture-visible-stream')) {
      const visible = await readVisibleResponse(response.clone());
      await save(`response-${before.calls + 1}-public.json`, visible);
      meta.history.push({ response: before.calls + 1, diagnostic: 'public-stream-only', elapsedMs: Date.now() - startedAt,
        finishReason: visible.finishReason, refused: visible.refused, toolCalls: visible.toolCalls, contentChars: visible.text.length });
      await persist();
    }
    if (response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
      try {
        const raw = await response.clone().json(), details = raw?.usage?.completion_tokens_details;
        const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
        meta.history.push({ response: before.calls + 1, elapsedMs: Date.now() - startedAt, inputTokens: count(raw?.usage?.prompt_tokens), outputTokens: count(raw?.usage?.completion_tokens), reasoningTokens: count(details?.reasoning_tokens), contentChars: typeof raw?.choices?.[0]?.message?.content === 'string' ? raw.choices[0].message.content.length : 0 });
        await persist();
      } catch { /* Telemetry must not change production response handling. No body is saved here. */ }
    }
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      let errorCategory = null;
      try {
        const body = await response.clone().text(); // Classify only; never print/persist the upstream error body.
        if (/insufficient.quota|insufficient.balance|余额不足|额度不足/i.test(body)) errorCategory = 'quota-or-balance';
        else if (/rate.?limit|too many requests|限流/i.test(body)) errorCategory = 'rate-limit';
      } catch { /* Let the production provider preserve the original transport failure. */ }
      meta.history.push({ httpStatus: response.status, errorCategory, retryAfter: retryAfter?.slice(0, 80) ?? null, cumulative: before.calls + 1, at: Date.now() });
      await persist();
    }
    return response;
  };
  let stepCalls = 0;
  const lock = async (_name, signal, operation) => { signal.throwIfAborted(); return operation(); };
  const director = createDirectorDriver({ lock, provider: createDirectProvider(transport), lowProvider: createLowProvider(transport) });
  const gm = createExpeditionGMDriver({ lock, provider: createDirectProvider(transport) });
  const node = createNodeDriver({ lock, provider: createLowProvider(transport) });
  const settlement = createSettlementDriver({ lock, provider: createDirectProvider(transport) });
  const directorPort = { read: async () => ({ head: f.raw().head, ...f.raw().airpDirector }), async commit(command) { await send(command); return this.read(); } };
  async function checked(label, driver, operation) {
    console.log(sanitize({ event: 'cl-f-stage', label, directory }));
    await operation(); await persist();
    const status = driver.getSnapshot(); await save(`${label}-${meta.calls}-status.json`, status);
    meta.history.push({ label, status, at: Date.now(), cumulative: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0) }); await persist();
    if (status.pendingResult) await save(`${label}-unsaved.json`, driver.exportPending());
    assert.equal(status.error, null, `${label}: ${status.error}`);
  }
  async function homeSettlement() {
    if (!pendingHomeBoundary(f.raw())) return;
    const id = await flow.settleHome();
    if (flags.includes('--refresh-settlement')) {
      await flow.refreshHomeSettlement();
      meta.history.push({ explicitSettlementRefresh: id, at: Date.now() }); await persist();
    }
    if (flags.includes('--settlement-max-tokens=32768') && meta.settlementMaxTokens !== 32768) {
      const job = (await flow.settlement.read()).ledger.jobs.find(j => j.id === id);
      assert.equal(job.status, 'failed', 'Only explicitly refresh a failed settlement output budget');
      const frame = job.frames.at(-1);
      await flow.settlement.refresh(id, frame.input, frame.materials);
      meta.settlementMaxTokens = 32768;
      meta.history.push({ explicitSettlementOutputBudget: 32768, previous: config.models.updater.max_tokens, frozenInputUnchanged: true, at: Date.now() });
      await persist();
    }
    const current = connection('updater');
    if (meta.settlementMaxTokens) current.config = { ...current.config, max_tokens: meta.settlementMaxTokens };
    await checked(`settlement-${meta.step}`, settlement, () => settlement.run(flow.host.settlement, id, current));
  }
  async function sceneTurn() {
    // Resume a returned home-assessment failure without reopening the now-advanced scene.
    if (pendingHomeBoundary(f.raw())) { await homeSettlement(); return; }
    for (let i = 0; !directorView(f.raw()).entrances.some(e => e.event.id === meta.eventId) && i < 12; i++) await send({ type: 'advance-phase' });
    assert(directorView(f.raw()).entrances.some(e => e.event.id === meta.eventId), 'Event actor unavailable after bounded wait');
    await send({ type: 'airp-director-open', eventId: meta.eventId });
    const id = f.raw().airpDirector.reading.jobId;
    assert(currentJob(id), 'Scene is waiting for explicit delivery, not generation');
    if (writingOverride && !currentJob(id).text) {
      const job = currentJob(id), previous = job.connections?.filter(c => c.stage === 'writing').at(-1)?.config ?? f.raw().airpDirector.materials[job.materialHash].models.writing;
      if (canonicalJson(previous) !== canonicalJson(writingOverride.config)) {
        assert.equal(job.attempts.at(-1)?.status, 'failed', 'Only switch an explicitly failed writing request');
        const frozenHash = job.lowFrame.requestHash;
        await send({ type: 'airp-director-reconnect', jobId: id, config: writingOverride.config });
        assert.equal(currentJob(id).lowFrame.requestHash, frozenHash, 'Model switch changed the frozen prompt');
        meta.history.push({ explicitWritingModelOverride: writingOverride.proof, previousModel: previous.model, jobId: id,
          frozenRequestHash: frozenHash, presetAndSamplingUnchanged: true, localConfigUnchanged: true });
        await persist();
      }
    }
    if (flags.includes('--revalidate-writing') && currentJob(id).attempts.at(-1)?.error === 'invalid-output') await send({ type: 'airp-director-revalidate-low', jobId: id, readerVersion: 4 });
    if (!currentJob(id).text || directorStage(currentJob(id))) await checked(`scene-${meta.step}`, director, () => director.run(directorPort, id, config));
    const job = currentJob(id); assert(job.text, 'No admitted scene');
    await save(`${meta.step}${contextVersion >= 11 ? '-turn-' + (job.scene.dialogue?.turn ?? 0) : ''}-cn.md`, `# ${job.scene.role} · ${currentEvent().card.title}\n\n${job.text.lines.map(l => `${l.speaker}[${l.emotion}]：${l.text}`).join('\n\n')}\n\n程序选项：\n${job.scene.choices.map(c => `${c.id}: ${c.label}`).join('\n')}\n\n模型候选态度（不执行）：\n${job.lowChoices?.join('\n') ?? ''}\n\n${job.lowPhase ? JSON.stringify({phase: job.lowPhase, fidelity: job.lowFidelity}) : ''}\n`);
    if (f.raw().airpDirector.cursors[id] === undefined) await send({ type: 'airp-director-show', jobId: id });
    for (let cursor = f.raw().airpDirector.cursors[id]; cursor < job.text.lines.length; cursor++) {
      if (job.lowContextVersion >= 8 && cursor === job.text.lines.length - 1 && job.lowChoices?.length && !currentJob(id).lowResponse) {
        await send({ type: 'airp-director-respond', jobId: id, index: 0 });
        meta.selectedAttitudes.push({ jobId: id, index: 0, text: job.lowChoices[0], programDecision: false });
      }
      await send({ type: 'airp-director-read', jobId: id, cursor });
    }
    await homeSettlement();
  }
  async function scene() {
    for (let turn = 0; turn < 6; turn++) {
      await sceneTurn();
      const r = f.raw().airpDirector.reading, j = r && currentJob(r.jobId);
      if (contextVersion < 11 || !r || r.completed || j?.lowPhase?.complete) {
        if (contextVersion >= 11 && r?.completed && !r.paused) await send({type: 'airp-director-pause'});
        return true;
      }
      assert(j && !j.text, 'Unfinished dialogue must have its next writing task');
      if (flags.includes('--single-scene-turn')) return false; // Inspection checkpoint, never force the GM's completion.
    }
    throw Error('Dialogue has not concluded after six tester responses; retained without forcing completion');
  }
  async function day() {
    const dayNumber = f.raw().snapshot.campaign.clock.day;
    let job = f.raw().airpDirector.jobs.filter(j => j.kind === 'day' && j.planning.budget.day === dayNumber).at(-1);
    if (!job) { await send({ type: 'airp-director-prepare-day' }); job = f.raw().airpDirector.jobs.at(-1); }
    if (job.acceptedEntries === null) await checked(`gm-${meta.step}`, director, () => director.run(directorPort, job.id, config));
    if (!f.raw().airpDirector.days.some(d => d.day === dayNumber)) await send({ type: 'airp-director-accept-day', jobId: job.id });
    await save(`${meta.step}-plan.json`, currentJob(job.id));
  }
  await flow.sync();
  if (!meta.completed && !f.raw().snapshot.run && f.raw().airpDirector.materialHash && (f.raw().airpDirector.lowReadVersion !== readerVersion || f.raw().airpDirector.lowContextVersion !== contextVersion)) await send({ type: 'airp-director-configure', material: f.raw().airpDirector.materials[f.raw().airpDirector.materialHash], lowReadVersion: readerVersion, lowContextVersion: contextVersion });
  if (flags.includes('--initialize-only')) {
    assert.equal(f.raw().contentRef.contentVersion, contentVersion);
  } else if (meta.step === 'day') {
    if (!f.raw().airpDirector.materialHash) {
      const state = createAiConfiguration(); state.importConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
      const material = effectiveAiConfiguration(state.getSnapshot()).material;
      // Same full source activation as the production day-preparation UI.
      material.resources.sources = structuredClone(activatedDirectorDocuments); material.models = structuredClone(config.models);
      await send({ type: 'airp-director-configure', material, lowMaterial: lowR8Source, lowReadVersion: readerVersion, lowContextVersion: contextVersion });
    }
    if (meta.dayPlanFixture && !f.raw().airpDirector.days.length) {
      const { directorPlan } = await load('game-application/testing/airp-director-playthrough');
      await directorPlan({read: async () => f.raw(), send}, {kind: 'fixed', definitionId: meta.dayPlanFixture});
      meta.history.push({fixedDayFixture: meta.dayPlanFixture, realGmEvidence: false});
    } else await day();
    const candidates = f.raw().airpDirector.events.filter(e => e.card.actions.some(a => a.kind === 'patrol'));
    assert(candidates.length, 'Real GM chose no sortie; inspect its plan without substituting a mock');
    meta.eventId = candidates[0].id; meta.step = 'offer';
  } else if (['offer', 'acceptance', 'action'].includes(meta.step)) {
    const step = meta.step, finished = await scene();
    if (finished) {
      if (step !== 'acceptance') {
        const e = currentEvent(), choices = step === 'offer' ? e.card.choices : e.card.actions[e.actionIndex].choices;
        await send({ type: 'airp-director-choose', eventId: e.id, choiceId: choices[0].id });
        meta.history.push({ testerChoice: choices[0].id, step });
        if (contextVersion >= 20 && currentEvent().narrativeSkips?.length) {
          meta.history.push({narrativeSkips: currentEvent().narrativeSkips});
          await save('narrative-skips.json', currentEvent().narrativeSkips);
          if (f.raw().airpDirector.reading?.completed) await send({type: 'airp-director-pause'});
        }
      }
      meta.step = currentEvent().actionPhase !== null ? 'expedition-plan' : step === 'offer' ? 'acceptance' : step === 'acceptance' ? 'action' : 'expedition-plan';
    }
  } else if (meta.step === 'expedition-plan') {
    const e = currentEvent(), objective = AIRP_GAME_CATALOG.data.airpDirector.capabilities.objectives[e.card.actions[e.actionIndex].objectiveId];
    const departure = { ...f.departure, routeId: objective.routeId };
    const existingPlan = f.raw().airpGame.gm.jobs.find(j => j.frames.at(-1).departure.runId === departure.runId);
    const id = existingPlan?.id ?? await flow.prepare(departure);
    if (['failed', 'stale'].includes((await flow.gm.read()).ledger.jobs.find(j => j.id === id).status)) await flow.gm.refresh(id);
    await checked('gm-expedition', gm, () => gm.run(flow.host.gm, id, connection('planning')));
    const permit = await flow.gm.departurePermit(id); await send({ type: 'start-expedition', ...permit.departure }); await flow.sync(); meta.step = 'expedition';
  } else if (meta.step === 'expedition') {
    // Each invocation generates at most one newly reached node; all actual triggered nodes are checked.
    let generated = false;
    for (let steps = 0; f.raw().snapshot.run && steps < 650; steps++) {
      await flow.sync(); const view = airpGameView(f.raw()), j = view?.node;
      if (j) {
        if (!j.selected) {
          if (generated) break;
          await flow.nodes.open(j.id);
          if (flags.includes('--revalidate-writing')) {
            const current = (await flow.nodes.read()).ledger.jobs.find(job => job.id === j.id);
            if (nodeStage(current) === 'writing' && current.attempts.some(a => a.stage === 'writing' && a.status === 'failed' && a.output)) {
              await flow.nodes.revalidateWriting(j.id);
              meta.history.push({ offlineWritingRevalidation: j.id, readerVersion: 3, at: Date.now() }); await persist();
            }
          }
          for (const stage of ['writing', 'formatting']) {
            const current = (await flow.nodes.read()).ledger.jobs.find(job => job.id === j.id);
            if (nodeStage(current) !== stage) continue;
            if (stage === 'writing' && writingOverride) {
              const prior = current.attempts.filter(a => a.stage === stage).at(-1);
              assert(prior && ['failed', 'interrupted'].includes(prior.status), 'Node model diagnostic only resumes a failed/interrupted writing request');
              const connectionHash = sha256(canonicalJson(writingOverride.config)), frozenHash = current.frame.requestHash;
              await flow.nodes.changeConnection(j.id, stage, connectionHash);
              assert.equal((await flow.nodes.read()).ledger.jobs.find(job => job.id === j.id).frame.requestHash, frozenHash, 'Node model switch changed the frozen prompt');
              meta.history.push({ explicitWritingModelOverride: writingOverride.proof, previousModel: prior.model, nodeId: j.id,
                frozenRequestHash: frozenHash, presetAndSamplingUnchanged: true, localConfigUnchanged: true });
              await persist();
            }
            await checked(`node-${j.node.id}-${stage}`, node, () => node.run(flow.host.nodes, j.id, connection(stage === 'writing' ? 'writing' : 'updater')));
          }
          const result = (await flow.nodes.read()).ledger.jobs.find(job => job.id === j.id);
          await save(`node-${j.node.id}-cn.md`, `# 副本节点 ${j.node.id}\n\n${result.text.lines.map(l => `${l.speaker}[${l.emotion}]：${l.text}`).join('\n\n')}\n\n${result.text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`);
          for (let i = result.reads.length; i < result.text.lines.length; i++) await flow.nodes.readLine(j.id, i);
          await flow.nodes.choose(j.id, 0); meta.selectedAttitudes.push({ nodeId: j.id, index: 0, text: result.text.choices[0] }); generated = true; continue;
        }
        if (view.boundary) {
          const id = await flow.settle(j.id);
          if (flags.includes('--node-program-facts')) {
            const assessment = (await flow.settlement.read()).ledger.jobs.find(job => job.id === id);
            assert.equal(assessment.status, 'failed', 'Explicit fallback only for this failed assessment');
            await flow.useProgramFacts(j.id); await flow.sync();
            meta.history.push({ explicitFactsOnlyFallback: id, nodeId: j.id, reason: 'failed-model-assessment; original retained; no affinity or narrative-state judgment', at: Date.now() });
            await persist(); generated = true; continue;
          }
          if (flags.includes('--refresh-settlement') && ['failed', 'stale'].includes((await flow.settlement.read()).ledger.jobs.find(job => job.id === id).status)) {
            await flow.refreshSettlement(j.id); generated = true;
            meta.history.push({ explicitSettlementRefresh: id, at: Date.now() }); await persist();
          }
          await checked(`node-${j.node.id}-settlement`, settlement, () => settlement.run(flow.host.settlement, id, connection('updater')));
          await flow.nodes.complete(j.id); await flow.sync(); continue;
        }
      }
      const run = f.raw().snapshot.run, command = nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw());
      if (command.type === 'choose-exit' && run.state.run.layer >= 3) { command.choice = 'leave'; meta.history.push({ deviation: 'early-extraction', layer: run.state.run.layer, runId: run.id }); }
      await send(command); if (steps % 16 === 0) { await persist(); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
    if (!f.raw().snapshot.run) {
      assert(currentEvent().actionOutcome === 'succeeded' || contextVersion >= 9 && currentEvent().role === 'result'); assert.equal(currentEvent().delivery?.status, 'pending');
      meta.step = currentEvent().role === 'result' ? 'delivery-result' : 'feedback'; meta.returnedLoot = f.raw().snapshot.campaign.loot; meta.returnedAtDay = f.raw().snapshot.campaign.clock.day;
    }
  } else if (meta.step === 'feedback') {
    const finished = await scene(); assert.equal(currentEvent().delivery.status, 'pending');
    if (finished) meta.step = 'delivery-result';
  } else if (meta.step === 'delivery-result') {
    if (currentEvent().delivery.status !== 'confirmed') {
      for (let i = 0; !directorView(f.raw()).entrances.some(e => e.event.id === meta.eventId) && i < 12; i++) await send({ type: 'advance-phase' });
    }
    const before = f.raw().snapshot.campaign.loot;
    if (currentEvent().delivery.status !== 'confirmed') await send({ type: 'airp-director-deliver', eventId: meta.eventId });
    assert.deepEqual(f.raw().snapshot.campaign.loot, before, 'Task delivery must not award/remove ordinary loot');
    const finished = await scene();
    if (finished) { assert.equal(currentEvent().status, 'resolved'); meta.step = 'day-after'; }
  } else if (meta.step === 'day-after') {
    assert(!pendingHomeBoundary(f.raw()));
    if (!meta.appraisal) {
      const item = f.raw().snapshot.campaign.loot?.find(item => item.resultId === null);
      if (item && f.raw().snapshot.campaign.funds.party >= AIRP_GAME_CATALOG.data.loot.definitions[item.definitionId].appraisalFee) {
        const fundsBefore = f.raw().snapshot.campaign.funds.party;
        await send({ type: 'appraise-loot', shopId: 'shop.mansion', instanceId: item.instanceId, quoteVersion: AIRP_GAME_CATALOG.data.loot.quoteVersion });
        const after = f.raw(), replay = await f.runtime.application.dispatch(lastRequest);
        assert(replay.ok && replay.replayed); assert.deepEqual(f.raw(), after);
        meta.appraisal = { instanceId: item.instanceId, source: item.source, grantId: item.grantId, chargedCopper: fundsBefore - after.snapshot.campaign.funds.party, before: item.resultId, after: after.snapshot.campaign.loot.find(i => i.instanceId === item.instanceId).resultId, repeatRequest: 'no-extra-charge-or-item' };
      } else meta.appraisal = { tested: false, reason: item ? 'insufficient-actual-funds' : 'no-unidentified-item-returned' };
    }
    // The feedback can wait until the following dusk for its actor. Schedule at
    // the next actual morning after closure, not a late-day slot after return.
    meta.nextGmDay ??= f.raw().snapshot.campaign.clock.day + 1;
    for (let i = 0; f.raw().snapshot.campaign.clock.day < meta.nextGmDay && i < 8; i++) await send({ type: 'advance-phase' });
    assert(f.raw().snapshot.campaign.clock.day >= meta.nextGmDay, 'Next morning was not reached');
    await day(); meta.step = 'done';
  } else assert.equal(meta.step, 'done');
  const exported = await f.runtime.application.exportSave('formal-airp'); assert(exported.ok);
  assert.deepEqual(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS), f.raw());
  meta.history.push({ phaseCompletedAt: Date.now(), nextStep: meta.step, phaseCalls: stepCalls, revision: f.raw().head.revision });
  if (meta.step === 'done') {
    meta.completed = true;
    await save('acceptance.json', { classification: meta.classification, calls: meta.calls, cumulative: expected + stepCalls, event: currentEvent(),
      state: f.raw().airpGame.settlement.state, memories: f.raw().airpGame.settlement.memories, openThreads: f.raw().airpGame.settlement.openThreads,
      inventory: f.raw().snapshot.campaign.loot, latestDay: f.raw().airpDirector.jobs.filter(j => j.kind === 'day').at(-1), meta });
  }
  await persist(); console.log(sanitize({ event: 'cl-f-checkpoint', directory, nextStep: meta.step, phaseCalls: stepCalls, cumulative: expected + stepCalls, totalCalls: meta.calls }));
} catch (error) {
  const reason = String(error?.message ?? 'failed').slice(0, 8000);
  recordFailure?.(reason);
  if (persist) await persist(); console.log(sanitize({ event: 'cl-f-stopped', directory, reason })); process.exitCode = 1;
} finally {
  if (lockFile) { await lockFile.close(); await fs.unlink(`${ledgerPath}.cl-f.lock`); }
  await vite.close();
}
