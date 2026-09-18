/** Test-only, loopback native host. A private temporary database and fake providers; never a user installation. */
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.send) throw Error('This fixture is launched over test IPC only');
const rpRoot = resolve(process.argv[2]);
if (JSON.parse(await readFile(resolve(rpRoot, 'package.json'), 'utf8')).name !== 'rp-style-lab') throw Error('Expected rp-style-lab');
const { createAirpFixture } = await import(pathToFileURL(resolve(rpRoot, 'server/test/support/application-packages/airp-fixture.ts')).href);
const fixture = await createAirpFixture();
const fake = fixture.runtime.fakeProviders.primary;
fake.scripts = [];
fake.script = { error: new Error('Unexpected model call: provide an explicit fake script') };
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await fixture.runtime.cleanup();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('disconnect', () => void stop());
process.on('message', async message => {
  try {
    if (message.type === 'stop') return await stop();
    if (message.type === 'scripts') fake.scripts.push(...message.scripts);
    if (!['scripts', 'inspect'].includes(message.type)) throw Error('Unknown fixture operation');
    process.send({ id: message.id, ok: true, result: {
      calls: fake.calls.map(call => JSON.parse(JSON.stringify(call))),
      sessionCount: fixture.runtime.database.sqlite.prepare('SELECT count(*) AS n FROM session').get().n,
      ...(message.receipt ? { state: fixture.state(message.receipt), checkpoint: fixture.snapshot(message.receipt) } : {}),
    } });
  } catch (error) { process.send({ id: message.id, ok: false, error: String(error) }); }
});
const address = await fixture.runtime.app.listen({ host: '127.0.0.1', port: 0 });
process.send({ type: 'ready', baseUrl: `${address}/api/v1`, releaseId: fixture.created.release.id });
