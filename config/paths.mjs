import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const projectRoot = resolve(import.meta.dirname, '..');
export const distRoot = resolve(projectRoot, 'dist');

/** @param {string} parent @param {string} child */
export function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Resolve even a not-yet-created path through its nearest real ancestor. @param {string} path */
function physicalPath(path) {
  const tail = [];
  let parent = resolve(path);
  while (!existsSync(parent)) {
    tail.unshift(basename(parent));
    parent = dirname(parent);
  }
  return resolve(realpathSync(parent), ...tail);
}

/** Only the target's own directory or an explicit external temporary directory may be emptied.
 * @param {string} directory @param {string} expectedDirectory
 */
export function assertOutputDirectory(directory, expectedDirectory) {
  const actual = physicalPath(directory);
  const realRoot = realpathSync(projectRoot);
  const expected = resolve(realRoot, relative(projectRoot, expectedDirectory));
  if (actual === expected && isWithin(resolve(realRoot, 'dist'), actual)) return actual;
  const temporaryRoots = [tmpdir(), '/tmp'].filter(existsSync).map(root => realpathSync(root));
  if (!isWithin(realRoot, actual) && actual !== realRoot && temporaryRoots.some(root => isWithin(root, actual))) return actual;
  throw new Error(`Unsafe output directory: ${directory}. Use ${expectedDirectory} or an external temporary directory.`);
}
