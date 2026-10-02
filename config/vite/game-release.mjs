/** @param {import('../types.js').GameBuild} build @param {boolean} enabled @returns {import('vite').Plugin} */
export function gameRelease(build, enabled) {
  const body = JSON.stringify(build.release, null, 2) + '\n';
  return {
    name: 'abyssa-game-release',
    generateBundle() {
      if (enabled) this.emitFile({type: 'asset', fileName: 'release.json', source: body});
    },
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/release.json') return next();
        response.setHeader('content-type', 'application/json');
        response.setHeader('cache-control', 'no-store');
        response.end(body);
      });
    },
  };
}
