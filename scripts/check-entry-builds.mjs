import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { entries } from '../config/entries.mjs';
import { buildTarget } from './lib/build-target.mjs';
import { validateBuildOutput } from './check-build-output.mjs';

const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'abyssa-entry-builds-'));
try {
  for (const entry of entries) {
    const target = `entry:${entry.id}`;
    const outDir = resolve(temporaryRoot, entry.id);
    await buildTarget(target, { outDir });
    const errors = await validateBuildOutput(target, outDir);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Compatibility target passed: ${entry.id}`);
    await rm(outDir, { recursive: true });
  }
} finally { await rm(temporaryRoot, { recursive: true, force: true }); }
