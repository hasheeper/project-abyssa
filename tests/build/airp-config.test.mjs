import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTargetConfig } from '../../config/vite/create-config.mjs';

test('all dev targets keep the existing denylist and block the local AIRP credential file', () => {
  for (const id of ['entry:airp', 'game', 'lab', 'tools']) {
    const deny = createTargetConfig(id).server?.fs?.deny; assert.ok(deny);
    assert.ok(deny.includes('**/*.local.json'));
    assert.ok(deny.includes('**/dist/reports/**'));
    for (const pattern of ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**']) assert.ok(deny.includes(pattern));
  }
});

test('Vite refuses HTTP and @fs reads of the credential filename without reading its contents', async () => {
  const config = createTargetConfig('entry:airp', { open: false });
  // Never inspect a developer's actual local file; exercise the same denylist
  // with a disposable synthetic file so this also runs in a clean checkout.
  const fixture = await mkdtemp(join(tmpdir(), 'abyssa-airp-deny-'));
  const paths = ['airp-test.local.json', 'connection-copy.local.json', 'dist/reports/private/example.archive.local.json'];
  for (const path of paths) {
    await mkdir(join(fixture, path, '..'), { recursive: true });
    await writeFile(join(fixture, path), '{"synthetic":true}');
  }
  const server = await createServer({ configFile: false, root: fixture, logLevel: 'silent', server: { ...config.server, port: 0, fs: { ...config.server?.fs, allow: [fixture] } } });
  try {
    await server.listen(); const address = server.httpServer?.address(); assert.ok(address && typeof address !== 'string');
    for (const path of paths) {
      for (const pathname of [`/${path}`, `/@fs${fixture}/${path}`]) {
        /** @type {Response} */
        const response = await fetch(`http://127.0.0.1:${address.port}${pathname}`);
        assert.equal(response.status, 403); await response.body?.cancel();
      }
    }
  } finally { await server.close(); await rm(fixture, { recursive: true, force: true }); }
});
