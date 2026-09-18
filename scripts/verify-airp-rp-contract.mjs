/**
 * Cross-repository CONTRACT verification, not the production AIRP application.
 * Run using rp's tsx loader and ABI-compatible Node; all server data is temporary.
 * No real Provider, user database, package installation or deployment is used.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { airpOnlineFixture } from '../src/game-application/testing/airp-online-fixture.ts';
import { prepareAirpScene, acceptAirpScene } from '../src/game-application/airp/acceptance.ts';
import { createAirpRpHttpClient } from '../src/game-infrastructure/airp/rp-http-client.ts';

const argument = process.argv.indexOf('--rp-root');
if (argument < 0 || !process.argv[argument + 1]) throw new Error('Pass --rp-root /absolute/path/to/rp-style-lab');
const rpRoot = resolve(process.argv[argument + 1]);
const manifest = JSON.parse(await readFile(resolve(rpRoot, 'package.json'), 'utf8'));
assert.equal(manifest.name, 'rp-style-lab', 'Expected the explicit rp repository');
const source = name => pathToFileURL(resolve(rpRoot, name)).href;
const { prepareWorkflow } = await import(source('server/test/integration/workflow-fixture.ts'));
const { TEST_PARTICIPANT } = await import(source('server/test/support/runtime/test-runtime.ts'));
const fixture = await prepareWorkflow('airp-native-client-contract', { release: false });

try {
  const sample = airpOnlineFixture(), service = fixture.runtime.modules.applications.service;
  // Native InvocationInputSchemaV1 uses "list", not JSON Schema's "array".
  const schema = value => Array.isArray(value)
    ? { type: 'list', items: schema(value[0]), maxItems: 24 }
    : value !== null && typeof value === 'object'
      ? { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schema(child)])), required: Object.keys(value) }
      : { type: typeof value === 'number' ? 'number' : 'string' };
  const inputSchema = schema(sample.request);
  const contract = service.getArtifact(fixture.contractArtifactId);
  const action = contract.draft.actions.generate;
  action.input = { schemaId: 'airp-scene-request-v1', schemaVersion: 1, schema: inputSchema };
  action.output = { schemaId: 'airp-action-output-v1', schemaVersion: 1, schema: { type: 'string' } };
  contract.draft.actions = { 'generate-scene': action };
  service.saveArtifactDraft(fixture.applicationId, fixture.contractArtifactId, { expectedRevision: contract.artifact.draftRevision, document: contract.draft });
  for (const id of Object.values(contract.draft.projections)) {
    const artifact = service.getArtifact(id), projection = artifact.draft;
    projection.selectors[0].schemaId = action.input.schemaId;
    projection.selectors[0].schema = inputSchema;
    projection.renderer.escaping = 'json-value-v1';
    projection.output.maxBytes = 32768;
    service.saveArtifactDraft(fixture.applicationId, id, { expectedRevision: artifact.artifact.draftRevision, document: projection });
  }
  const workflow = service.getArtifact(fixture.workflowId);
  workflow.draft.nodes.at(-1).output = action.output;
  service.saveArtifactDraft(fixture.applicationId, fixture.workflowId, { expectedRevision: workflow.artifact.draftRevision, document: workflow.draft });
  const application = service.getApplication(fixture.applicationId);
  const release = service.createRelease(fixture.applicationId, { expectedRevision: application.application.draftRevision, version: '1.0.0' });
  const session = fixture.runtime.modules.conversations.service.createSession({ applicationReleaseId: release.id, greetingId: release.manifest.application.defaultGreetingId, participant: TEST_PARTICIPANT });
  const version = id => release.manifest.artifacts.find(artifact => artifact.artifactId === id).artifactVersionId;
  const ticket = prepareAirpScene({
    applicationId: fixture.applicationId, releaseId: release.id,
    sessionId: session.session.id, threadId: session.session.id, branchId: session.session.mainBranchId,
    contractVersionId: version(fixture.contractArtifactId), writingPipelineVersionId: version(fixture.pipelineIds.at(-1)), head: null,
  }, sample.request);
  fixture.runtime.fakeProviders.primary.scripts = [
    { chunks: ['先写检查搭扣，再写克制的回应。'] },
    { chunks: [JSON.stringify(sample.text)] },
  ];
  const client = createAirpRpHttpClient({ baseUrl: 'http://127.0.0.1/api/v1', fetch: async (url, init) => {
    const target = new URL(String(url));
    const response = await fixture.runtime.app.inject({
      method: init.method, url: target.pathname + target.search,
      ...(init.body ? { payload: JSON.parse(String(init.body)) } : {}), headers: { accept: 'application/json' },
    });
    return new Response(response.body, { status: response.statusCode, headers: { 'content-type': 'application/json' } });
  } });
  const result = await client.generate(ticket);
  assert.deepEqual(result.text, sample.text);
  const accepted = acceptAirpScene(ticket, result, sample.current);
  const replay = await client.generate(ticket);
  assert.deepEqual(replay, result);
  assert.equal(fixture.runtime.fakeProviders.primary.calls.length, 2);
  console.log(JSON.stringify({ check: 'Managed V8 host -> external client -> scene admission -> idempotent replay', status: 'passed', simulatedModelCalls: 2, realProviderCalls: 0, floorId: result.origin.floorId, sceneId: accepted.id }));
} finally {
  await fixture.runtime.cleanup();
}
