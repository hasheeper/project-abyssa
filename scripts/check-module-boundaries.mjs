import { resolve } from 'node:path';
import { checkModuleBoundaries } from './lib/module-boundaries.mjs';

const result = checkModuleBoundaries(resolve(import.meta.dirname, '..'));
if (result.violations.length) {
  console.error(`Module boundaries: ${result.violations.length} unexpected violation(s).`);
  for (const item of result.violations) console.error(`  ${item.file}:${item.line} [${item.code}] ${item.message}`);
  process.exitCode = 1;
} else {
  console.log(`Module boundaries: ${result.files} source files, ${result.coreFiles} core production files; no unexpected violations.`);
}
