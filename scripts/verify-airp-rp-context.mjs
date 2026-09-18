/** Cross-repo authored-code parity only: no runtime installation, HTTP, credentials or model calls. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { FIRST_AIRP_OPTION_STANCES, FIRST_AIRP_STORIES } from '../src/content/gameplay/airp-v1/story-data.ts';
import { airpPhaseIndex } from '../src/game-core/session/airp-readers.ts';

const argument = process.argv.indexOf('--rp-root');
if (argument < 0 || !process.argv[argument + 1]) throw Error('Pass --rp-root /absolute/path/to/rp-style-lab');
const rpRoot = resolve(process.argv[argument + 1]);
assert.equal(JSON.parse(await readFile(resolve(rpRoot, 'package.json'), 'utf8')).name, 'rp-style-lab');
const { medicineCaseContext, assembleSceneSemantics } = await import(pathToFileURL(resolve(rpRoot, 'applications/airp/resources/scene-context.ts')).href);
const { medicineCaseSources, medicineCaseSlices } = await import(pathToFileURL(resolve(rpRoot, 'applications/airp/resources/medicine-case-sources.ts')).href);
const abyssRoot = resolve(import.meta.dirname, '..');
for (const [key, source] of Object.entries(medicineCaseSources)) {
  const bytes = await readFile(resolve(abyssRoot, source.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, `Source changed: review the slice before replacing ${source.path}`);
  for (const slice of medicineCaseSlices.filter(s => s.source === key))
    assert.ok(bytes.toString('utf8').includes(slice.quote), `Excerpt is not verbatim: ${slice.id}`);
}
const choice = FIRST_AIRP_STORIES.offer.nodes.find(n => n.kind === 'choice');
assert.ok(choice);
for (const option of choice.options)
  assert.equal(medicineCaseContext.chosenActions[FIRST_AIRP_OPTION_STANCES[option.id]], option.label);
let checks = 0;
for (let day = 1; day <= 64; day++) for (const phaseCode of ['dawn', 'day', 'dusk', 'night']) {
  const phase = airpPhaseIndex(day, phaseCode);
  const context = assembleSceneSemantics({ phase, locationId: 'mansion.common-room', actorIds: ['elora'], task: 'return', stance: 'seasoned', outcome: 'cleared' }, []);
  assert.equal(context.locus.time.day, day);
  assert.equal(context.locus.time.phaseCode, phaseCode);
  assert.equal(context.locus.time.phaseIndex, phase);
  checks++;
}
console.log(JSON.stringify({ check: 'AIRP source hashes/excerpts, authored choices and gameplay clock', sources: Object.keys(medicineCaseSources).length, excerpts: medicineCaseSlices.length, authoredChoices: choice.options.length, clockCases: checks, realProviderCalls: 0, status: 'passed' }));
