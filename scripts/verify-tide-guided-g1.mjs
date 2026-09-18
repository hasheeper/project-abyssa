import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { projectRoot } from "../config/paths.mjs";

// Keep validation failures readable; a bundled data URL is not a useful stack frame.
process.on("uncaughtException", error => { console.error(error.message); process.exitCode = 1; });

const bundle = await build({
  absWorkingDir: projectRoot,
  stdin: { resolveDir: projectRoot, contents: `
    export * from './src/game-core/session/testing/tide-guided-g1';
    export { validateD5Catalog } from './src/game-core/contracts';
    export { AIRP_POOL_CATALOG_DATA } from './src/content/gameplay/demo-v9/content';
    export { MORNING_DEPARTURE_CATALOG_DATA } from './src/content/gameplay/demo-v6/content';
    export { replayG1Application } from './src/game-application/testing/tide-guided-g1-playthrough';
  ` },
  bundle: true, write: false, format: "esm", platform: "node", target: "es2022",
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const catalog = api.validateD5Catalog(api.AIRP_POOL_CATALOG_DATA);
const search = process.argv.includes("--search");
const number = process.argv.find(v => /^\d+$/.test(v));
const from = Number(process.argv.find(v => v.startsWith("--from="))?.slice(7) ?? 1);
let seed = Number(number ?? (search ? 30_000_000 : api.G1_CONTINUATION_SEED)), searchEvidence = null;
if (search) {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 50_000_000) throw Error("Search limit: 1–50,000,000");
  const limit = seed, reasons = {};
  let sieved = 0, found = null;
  if (!Number.isSafeInteger(from) || from < 1 || from > limit) throw Error("Invalid --from seed");
  for (let candidate = from; candidate <= limit; candidate++) {
    if (api.g1SeedSieve(candidate)) {
      sieved++;
      try { api.g1Candidate(candidate, catalog, false); found = candidate; break; }
      catch (error) {
        if (!(error instanceof api.CandidateRejected)) throw new Error(`Engine error at seed ${candidate}: ${error.message}`);
        reasons[error.message] = (reasons[error.message] ?? 0) + 1;
      }
    }
    if (candidate % 100_000 === 0) console.log(JSON.stringify({searched: candidate, sieved, reasons}));
  }
  if (found === null) throw Error(`No candidate in 1…${limit}: ${JSON.stringify(reasons)}`);
  seed = found; searchEvidence = {first: from, last: found, sieved, reasons};
}
const run = api.g1Candidate(seed, catalog);
const afterLesson = api.g1Snapshot(run.state), lessonTrace = [...run.trace];
api.g1ReachBoss(run);
const bossStart = structuredClone(run.state), standardBeforeBoss = [...run.trace];
const comparisons = [];
for (const strategy of ["crossbow-first", "chief-first", "ignore-intents"]) {
  run.state = run.engine.restore(bossStart);
  comparisons.push(api.g1FinishBoss(run, strategy));
}
const eventCatalog = api.g1EventCatalog(api.MORNING_DEPARTURE_CATALOG_DATA);
const eventRun = api.g1ReachEvent(eventCatalog, seed);
eventRun.step({type: "event", roomId: eventRun.state.run.roomIds[0][1], choice: "attempt", actorId: "elora"}, "E1.attempt");
console.log("Core and event samples finished; replaying the application export/exact recovery and claim.");
const application = await api.replayG1Application(catalog, [...standardBeforeBoss, ...comparisons[0].trace], seed);
const report = {
  plan: api.G1_PLAN, scope: "Existing four-battle route only; G2 five-room wiring is not implemented",
  contentRef: catalog.ref, seed, search: searchEvidence,
  initial: run.initial, lessonTrace, afterLesson, standardBeforeBoss, bossStart: api.g1Snapshot(bossStart), comparisons,
  eventFixture: {contentRef: eventCatalog.ref, initial: eventRun.initial, trace: eventRun.trace, result: eventRun.state.run.eventResults[0]},
  application,
  standardRngDraws: api.g1RngEvidence(run.initial, [...standardBeforeBoss, ...comparisons[0].trace]),
  eventRngDraws: api.g1RngEvidence(eventRun.initial, eventRun.trace),
};
const output = resolve(projectRoot, "dist/reports/tide-guided-g1");
await mkdir(output, {recursive: true});
await writeFile(resolve(output, "evidence.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({seed, lessonSteps: lessonTrace.length, bossEntryCursor: bossStart.run.rng.combat.cursor,
  comparisons: comparisons.map(({strategy, won, rounds, damage, downed, guards, terminal, final}) => ({strategy, won, rounds, damage, downed, guards, totalGold: terminal?.totalGold, supplies: final.supplies.map(s => [s.definitionId, s.charges])})),
  event: report.eventFixture.result, application, output}, null, 2));
