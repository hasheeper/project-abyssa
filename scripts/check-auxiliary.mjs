import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../config/paths.mjs';
import { fileHash, listFiles } from './lib/files.mjs';

const execute = promisify(execFile);
const directory = await mkdtemp(resolve(tmpdir(), 'abyssa-static-preview-'));
const original = await Promise.all((await listFiles(resolve(projectRoot, 'static-preview'))).map(async file => [file, await fileHash(file)]));
try {
  for (const file of (await listFiles(resolve(projectRoot, 'scripts'))).filter(file => file.endsWith('.mjs'))) await execute(process.execPath, ['--check', file]);
  await execute(process.execPath, [resolve(projectRoot, 'scripts/build-static-preview.mjs'), '--outDir', directory], { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 });
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  if (html.includes('<!-- COMPONENT_CATALOG -->') || !html.includes('Abyssa')) throw new Error('Static preview did not render');
  for (const [file, hash] of original) if (file && await fileHash(file) !== hash) throw new Error(`Static preview source changed: ${file}`);
  console.log('Auxiliary script syntax and isolated static preview checks passed.');
} finally { await rm(directory, { recursive: true, force: true }); }
