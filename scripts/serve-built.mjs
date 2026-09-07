import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { distRoot, isWithin } from '../config/paths.mjs';
import { isMain } from './lib/files.mjs';

/** Static artifacts only: no source serving, proxy, or SPA fallback. @param {string} [root] */
export function createArtifactServer(root = distRoot) {
  /** @type {Record<string,string>} */
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.apng': 'image/apng' };
  return createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname.startsWith('/abyssa/')) pathname = pathname.slice('/abyssa'.length);
      const group = /^\/(game|lab|tools)\//.exec(pathname)?.[1] ?? 'game';
      if (pathname.startsWith(`/${group}/`)) pathname = pathname.slice(group.length + 1);
      const directory = resolve(root, group);
      const file = resolve(directory, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!isWithin(directory, file) || !(await stat(file)).isFile()) throw new Error('Not found');
      response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
      response.setHeader('cache-control', 'no-store');
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });
}

if (isMain(import.meta.url)) {
  const server = createArtifactServer();
  const port = Number(process.env.ABYSSA_SMOKE_PORT ?? 5199);
  server.listen(port, '127.0.0.1', () => console.log(`Artifact server: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
