import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const pagesLimits = { dragAndDropFiles: 1000, wranglerFiles: 20000, fileBytes: 25 * 1024 * 1024 };
/** @param {string | Buffer} bytes */
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** A reviewable release must be reproducible from one committed source revision.
 * @param {{dirty?: boolean, revision?: string | null}} build
 * @param {{dirty?: boolean, revision?: string | null}} [current]
 */
export function assertReleaseSource(build, current = build) {
  if (build?.dirty !== false || current?.dirty !== false || typeof build.revision !== 'string' || !build.revision || build.revision !== current.revision)
    throw Error('Release source is not a clean Git revision; publication stopped.');
}

/** Never follow symlinks or silently skip hidden files in an upload inventory.
 * @param {string} directory
 * @returns {Promise<{path: string, bytes: number, sha256: string}[]>}
 */
export async function pagesInventory(directory) {
  if (!(await lstat(directory)).isDirectory()) throw Error('Upload root must be a real directory, not a symlink.');
  /** @type {{path: string, bytes: number, sha256: string}[]} */
  const files = [];
  /** @param {string} prefix */
  async function visit(prefix) {
    for (const item of await readdir(resolve(directory, prefix), {withFileTypes: true})) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isSymbolicLink() || !item.isFile() && !item.isDirectory()) throw Error('Special file in upload tree; publication stopped.');
      if (item.isDirectory()) await visit(path);
      else {
        const bytes = await readFile(resolve(directory, path));
        files.push({path, bytes: bytes.length, sha256: sha256(bytes)});
      }
    }
  }
  await visit('');
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

/** Accept runtime asset folders only, including the build's explicitly required reference art.
 * @param {string} path
 */
export function allowedPagesPath(path) {
  if (path === '.vite/manifest.json') return true;
  if (path.split('/').some(part => part.startsWith('.') || /(?:^|[.-])local(?:[.-]|$)/i.test(part))) return false;
  if (/(?:^|\/)(?:functions|config|reports|private|node_modules|src|st|_worker\.js)(?:\/|$)/i.test(path)) return false;
  if (/^(?:_headers|404\.html|game-assets\.json|game-cache\.js)$/.test(path)) return true;
  if (/^(?:index|battle|character-status|dice|mansion|map|menu|prologue|settings|shop|title)\.html$/.test(path)) return true;
  return /^(?:assets|character-art|emote-art|mansion-map|licenses)\/.+\.(?:js|css|json|txt|png|jpe?g|webp|avif|gif|apng|svg|woff2?|ttf|mp3|ogg|wav|wasm)$/i.test(path);
}

/** @param {{path: string, bytes: number}[]} files */
export function validatePagesInventory(files) {
  if (files.length > pagesLimits.wranglerFiles) throw Error('Pages file-count limit exceeded.');
  for (const file of files) {
    if (!allowedPagesPath(file.path)) throw Error('Unexpected upload path; review the local inventory before publication.');
    if (file.bytes > pagesLimits.fileBytes) throw Error('Pages single-file size limit exceeded.');
  }
}

/** Collect literal and serialized forms without ever returning config values in a report.
 * @param {unknown} configuration
 */
export function privateMarkers(configuration) {
  const keys = new Set(), endpoints = new Set();
  /** @param {Set<string>} target @param {string} value */
  function remember(target, value) {
    if (!value) return;
    target.add(value); target.add(JSON.stringify(value).slice(1, -1)); target.add(encodeURIComponent(value));
    if (value.length >= 12) target.add(Buffer.from(value).toString('base64'));
  }
  /** @param {unknown} value */
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [name, item] of Object.entries(value)) {
      if (name === 'apiKey' && typeof item === 'string') remember(keys, item.trim());
      else if (name === 'baseUrl' && typeof item === 'string' && item.trim()) {
        remember(endpoints, item.trim());
        try { remember(endpoints, new URL(item.trim()).origin); } catch { throw Error('Invalid private configuration; details withheld.'); }
      } else visit(item);
    }
  }
  visit(configuration);
  return {keys: [...keys], endpoints: [...endpoints]};
}

/** Scan every byte buffer, not just files with a text extension. No matches are printed.
 * @param {string} directory
 * @param {{path: string}[]} files
 * @param {{keys: string[], endpoints: string[]}} markers
 */
export async function scanPrivateMarkers(directory, files, markers) {
  const needles = [...markers.keys, ...markers.endpoints].map(value => Buffer.from(value));
  // Independent of a developer's local config, so clean CI also rejects obvious credentials.
  const credentialShape = /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|\bAIza[A-Za-z0-9_-]{35}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|\bhf_[A-Za-z0-9]{20,}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----)/;
  const credentialField = /["']?(?:(?:x[_-]?)?api[_-]?key|access[_-]?token|client_secret|password|authorization)["']?\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i;
  const bearerValue = /\bBearer [A-Za-z0-9._-]{20,}\b/;
  for (const file of files) {
    const bytes = await readFile(resolve(directory, file.path));
    if (needles.some(value => bytes.includes(value))) throw Error('Private credential or endpoint detected in upload bytes; publication stopped.');
    const text = bytes.toString('latin1');
    if (credentialShape.test(text) || credentialField.test(text) || bearerValue.test(text)) throw Error('Credential-shaped content detected in upload bytes; publication stopped.');
  }
}

/** Generate exact inline-script hashes for the build's legacy HTML bookmarks.
 * No unsafe-inline script permission, third-party scripts, telemetry or model proxy.
 * @param {string[]} documents
 */
export function pagesHeaders(documents) {
  const hashes = new Set();
  for (const html of documents) {
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const source = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(match[1]);
      if (source) {
        if (!/^\.\/assets\/[^?#]+\.js$/.test(source[2])) throw Error('Unexpected script source in deployment HTML.');
      } else if (match[2].trim()) hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
    }
  }
  const csp = ["default-src 'self'", `script-src 'self' ${[...hashes].sort().join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    "media-src 'self' data: blob:", "connect-src 'self' https:", "worker-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'"];
  const headers = [
    '/*',
    '  Cache-Control: public, max-age=0, must-revalidate, no-transform',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  X-Robots-Tag: noindex, nofollow',
    `  Content-Security-Policy: ${csp.join('; ')}`,
  ];
  if (headers.some(line => line.length > 2000)) throw Error('Pages header line exceeds the platform limit.');
  return headers.join('\n') + '\n';
}

/** The saved build report must account for every unmodified runtime asset.
 * @param {{path: string, bytes: number, sha256: string}[]} actual
 * @param {{path: string, bytes: number, sha256: string}[]} built
 */
export function verifyBuildSnapshot(actual, built) {
  const expected = new Map(built.map(file => [file.path, file]));
  if (expected.has('_headers') || expected.has('404.html')) throw Error('Build already contains deployment controls; review before replacing them.');
  for (const file of actual) {
    if (['_headers', '404.html'].includes(file.path)) continue;
    const source = expected.get(file.path);
    if (!source || source.bytes !== file.bytes || source.sha256 !== file.sha256) throw Error('Runtime bytes differ from the game build report; rebuild before publication.');
    expected.delete(file.path);
  }
  if (expected.size) throw Error('Game build files are missing from the upload directory.');
}
