import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { projectRoot } from "../config/paths.mjs";
import { isTestSupport } from "./lib/module-boundaries.mjs";
const outdir = resolve(projectRoot, "dist/reports/s2/import");
await mkdir(outdir, { recursive: true });
const common = {
  absWorkingDir: projectRoot,
  bundle: true,
  format: /** @type {const} */ ("esm"),
  platform: /** @type {const} */ ("node"),
  target: "node22",
  packages: /** @type {const} */ ("external"),
  treeShaking: false,
  metafile: /** @type {const} */ (true),
};
const core = await build({
  ...common,
  entryPoints: [
    "src/game-core/battle/index.ts",
    "src/game-core/contracts/index.ts",
    "src/game-core/session/index.ts",
  ],
  outdir: resolve(outdir, "core"),
  outExtension: { ".js": ".mjs" },
});
const application = await build({
  ...common,
  entryPoints: ["src/game-application/index.ts"],
  outfile: resolve(outdir, "application.mjs"),
});
for (const [name, built] of Object.entries({ core, application })) {
  assert.ok(typeof built !== "string");
  for (const path of Object.keys(built.metafile.inputs))
    assert.ok(
      path.endsWith(".ts") &&
        !isTestSupport(path) &&
        (path.startsWith("src/game-core/") ||
          (name === "application" && path.startsWith("src/game-application/"))),
      `Impure ${name} input: ${path}`,
    );
  for (const output of Object.values(built.metafile.outputs))
    assert.deepEqual(output.imports, [], "Pure entry requires external module");
}
const runtime = await build({
  ...common,
  stdin: {
    contents:
      'export * as legacy from "./src/game-runtime/legacy-battle"; export {LEGACY_VALIDATED_CATALOG as catalog} from "./src/game-runtime/legacy-context"; export {createGameApplication} from "./src/game-application"; export {MemoryGameStore} from "./src/game-infrastructure/storage/memory";',
    resolveDir: projectRoot,
  },
  outfile: resolve(outdir, "runtime.mjs"),
});
for (const path of Object.keys(runtime.metafile.inputs))
  assert.ok(!isTestSupport(path), "Production runtime imported tests");
const frozen = JSON.parse(
  await readFile(
    resolve(
      projectRoot,
      "src/game-core/battle/testing/fixtures/s1-extraction.json",
    ),
    "utf8",
  ),
);
const child = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `
import assert from 'node:assert/strict';
import {legacy,catalog,createGameApplication,MemoryGameStore} from ${JSON.stringify(pathToFileURL(resolve(outdir, "runtime.mjs")).href)};
assert.equal(typeof window,'undefined');assert.equal(typeof document,'undefined');
assert.deepEqual(Object.keys(legacy).sort(),${JSON.stringify(frozen.exports)});
const runs=[];
for(const seed of [11,29,47,83,131]){
 const app=createGameApplication({catalog,store:new MemoryGameStore()});
 assert.equal((await app.create({protocolVersion:1,saveId:'save',epoch:'epoch',clientRequestId:'create'})).ok,true);
 const read=async()=>{const r=await app.open('save');assert.equal(r.ok,true);return r.record;};
 const send=async(command)=>{const r=await read();const result=await app.dispatch({protocolVersion:1,saveId:'save',clientRequestId:'request-'+(r.head.revision+1),expectedHead:r.head,command});assert.equal(result.ok,true,JSON.stringify(result));return read();};
 await send({type:'start-expedition',expeditionId:'run',routeId:catalog.data.defaultRouteId,partyIds:[...catalog.data.defaultParty],itemIds:[],equipmentIds:[],seed});
 let r=await read(),steps=0;
 while(r.snapshot.expedition.lifecycle.type!=='finished'&&steps<1000){const type=r.snapshot.expedition.lifecycle.type==='exit-choice'?'leave-expedition':({'awaiting-roll':'roll-dice','player-turn':'end-turn','enemy-turn':'next-round'})[r.snapshot.encounter.turn.type];r=await send({type:'battle-command',expeditionId:'run',command:{type}});steps++;}
 assert.ok(r.pendingSettlement);r=await send({type:'settle-expedition',expeditionId:'run',terminalRef:r.pendingSettlement.terminalRef});assert.equal(r.snapshot.campaign.appliedSettlements.length,1);runs.push({seed,steps,funds:r.snapshot.campaign.funds});
}
console.log(JSON.stringify({node:process.version,exports:Object.keys(legacy).length,runs}));
`,
  ],
  { cwd: projectRoot, encoding: "utf8", timeout: 30000 },
);
if (child.status !== 0)
  throw new Error(
    `Headless application failed: ${child.error ?? child.stderr}`,
  );
const report = {
  coreInputs: Object.keys(core.metafile.inputs),
  applicationInputs: Object.keys(application.metafile.inputs),
  runtimeInputs: Object.keys(runtime.metafile.inputs),
  externalImports: 0,
  ...JSON.parse(child.stdout),
};
await writeFile(
  resolve(outdir, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  `Pure core/application closures verified; ${report.exports} compatible exports; ${report.runs.length} headless application expeditions settled. ${relative(projectRoot, outdir)}`,
);
