import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

/** @param {string} directory @returns {Promise<string[]>} */
export async function listFiles(directory) {
  const children = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(children.filter(entry => !['.DS_Store', '.git'].includes(entry.name)).map(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return groups.flat().sort();
}
/** @param {string} file */
export async function fileHash(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
/** @param {string} url */
export function isMain(url) { return !!process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href; }
