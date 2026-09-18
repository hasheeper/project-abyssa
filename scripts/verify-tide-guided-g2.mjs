import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { projectRoot } from "../config/paths.mjs";

process.on("uncaughtException", error => { console.error(error.message); process.exitCode = 1; });
const bundle = await build({absWorkingDir: projectRoot, stdin: {resolveDir: projectRoot, contents: `
  export { G2Recorder } from './src/game-core/session/testing/tide-guided-g2';
  export { g1RngEvidence } from './src/game-core/session/testing/tide-guided-g1';
  export { validateD5Catalog } from './src/game-core/contracts';
  export { GUIDED_TIDE_CATALOG_DATA } from './src/content/gameplay/demo-v11/content';
  export { replayG2Application } from './src/game-application/testing/tide-guided-g2-playthrough';
`}, bundle: true, write: false, format: "esm", platform: "node", target: "es2022"});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const catalog = api.validateD5Catalog(api.GUIDED_TIDE_CATALOG_DATA);
const run = new api.G2Recorder(catalog).until(s => s.tutorial.stage === "claimable");
console.log("G2 five-room core passed; verifying application transactions and four recovery points.");
const {report: application} = await api.replayG2Application(catalog, run.trace);
const report = {plan: "tide.guide.v1", scope: "G2 explicit content 11; default content 9 and UI unchanged",
  contentRef: catalog.ref, application, initial: run.initial, steps: catalog.data.tutorial.guide.steps,
  trace: run.trace, guide: run.state.tutorial.guide, rngDraws: api.g1RngEvidence(run.initial, run.trace),
  terminal: run.state.result, eventResults: run.state.run.eventResults};
const output = resolve(projectRoot, "dist/reports/tide-guided-g2");
await mkdir(output, {recursive: true});
await writeFile(resolve(output, "evidence.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({...application, output}, null, 2));
