import { createServer, preview } from 'vite';
import { createTargetConfig } from '../config/vite/create-config.mjs';
import { aggregateIds } from '../config/targets.mjs';
import { buildTarget } from './lib/build-target.mjs';

const [action, target, ...args] = process.argv.slice(2);
/** @type {import('../config/types.js').TargetOptions} */
const options = { enableAi: process.env.VITE_DICE_RUNTIME_ENABLED === 'true' };
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === '--open') options.open = true;
  else if (flag === '--no-open') options.open = false;
  else if (flag === '--ai') options.enableAi = true;
  else if (['--outDir', '--port', '--host'].includes(flag ?? '')) {
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--outDir') options.outDir = value;
    if (flag === '--host') options.host = value;
    if (flag === '--port') {
      options.port = Number(value);
      if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Invalid port');
    }
  } else throw new Error(`Unknown option: ${flag}`);
}
if (!target || !['dev', 'build', 'preview'].includes(action ?? '')) throw new Error('Usage: node scripts/run-target.mjs <dev|build|preview> <ui|game|lab|tools|entry:id|all> [--outDir path] [--port number] [--no-open] [--ai]');
if (target === 'all' && (action !== 'build' || options.outDir)) throw new Error('all is build-only and uses isolated default directories');

if (action === 'build') {
  for (const id of target === 'all' ? aggregateIds : [target]) await buildTarget(id, options);
} else {
  const config = createTargetConfig(target, options);
  if (action === 'dev') {
    const server = await createServer(config);
    await server.listen();
    server.printUrls();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
  } else {
    const server = await preview(config);
    server.printUrls();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.httpServer.close(() => process.exit(0)); });
  }
}
