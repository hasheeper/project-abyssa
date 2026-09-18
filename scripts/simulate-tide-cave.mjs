import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../config/paths.mjs";

const output = resolve(projectRoot, "dist/reports/tide-cave");
await mkdir(output, { recursive: true });
const moduleFile = resolve(output, "simulation-module.mjs");
await build({
  absWorkingDir: projectRoot,
  stdin: { resolveDir: projectRoot, contents: `
    export { TIDE_CAVE_CATALOG_DATA } from './src/content/gameplay/demo-v7/content';
    export { validateD5Catalog } from './src/game-core/contracts';
    export { createD5ExpeditionEngine, initialD5Projection } from './src/game-core/session';
    export { tutorialNextOperation } from './src/game-core/session/testing/tutorial-driver';
  ` },
  outfile: moduleFile, bundle: true, format: "esm", platform: "node", target: "es2022",
});
const api = await import(pathToFileURL(moduleFile).href);
const catalog = api.validateD5Catalog(api.TIDE_CAVE_CATALOG_DATA), spec = catalog.data.tutorial;
const engine = api.createD5ExpeditionEngine(catalog);
const samples = Number(process.argv[2] ?? 64);
if (!Number.isInteger(samples) || samples < 1 || samples > 256) throw Error("Use 1–256 samples per strategy");
const rows = [];
for (const strategy of ["basic", "tactical", "attack-only"]) {
  for (let index = 0; index < samples; index++) {
    const seed = Math.imul(index + 1, 0x9e3779b1) >>> 0;
    const campaign = api.initialD5Projection(catalog);
    campaign.prologue.status = "skipped"; campaign.opening.status = "viewed";
    let state = engine.create(campaign, { runId: "simulation", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed });
    const row = { strategy, seed, completed: false, stalled: false, rounds: [0,0,0,0], damage: 0, downed: 0, foodUsed: 0, potionsUsed: 0, guards: 0, covenants: 0, totalGold: 0 };
    for (let operation = 0; operation < 1000; operation++) {
      if (state.encounter) row.rounds[state.run.room] = Math.max(row.rounds[state.run.room], state.encounter.round);
      const next = api.tutorialNextOperation(catalog, state, strategy);
      if (!next) break;
      const result = engine.dispatch(state, next);
      for (const event of result.events) {
        if (event.type === "damage-applied" && event.payload.targetKind === "party-member") row.damage += event.payload.applied;
        if (event.type === "unit-downed") row.downed++;
        if (event.type === "guard-applied") row.guards++;
        if (event.type === "covenant-triggered") row.covenants++;
      }
      state = result.state;
      if (operation === 999) row.stalled = true;
    }
    row.completed = state.tutorial.stage === "claimable";
    row.foodUsed = 4 - state.run.supplies.find(s => s.definitionId === "item.food").charges;
    row.potionsUsed = 2 - state.run.supplies.find(s => s.definitionId === "item.potion").charges;
    row.totalGold = row.completed ? state.result.totalGold + spec.reward.gold : 0;
    rows.push(row);
    if ((index + 1) % 8 === 0) console.log(`${strategy}: ${index + 1}/${samples}`);
  }
}
const average = (values) => +(values.reduce((n,x)=>n+x,0) / values.length).toFixed(2);
const summary = ["basic", "tactical", "attack-only"].map(strategy => {
  const selected = rows.filter(r => r.strategy === strategy), wins = selected.filter(r => r.completed);
  return { strategy, samples, wins: wins.length, stalled: selected.filter(r=>r.stalled).length,
    averageDamage: average(selected.map(r=>r.damage)), averageDowned: average(selected.map(r=>r.downed)),
    averageFood: average(selected.map(r=>r.foodUsed)), averagePotion: average(selected.map(r=>r.potionsUsed)),
    winningRounds: [0,1,2,3].map(i=>wins.length ? average(wins.map(r=>r.rounds[i])) : null),
    goldRange: wins.length ? [Math.min(...wins.map(r=>r.totalGold)), Math.max(...wins.map(r=>r.totalGold))] : null,
  };
});
await writeFile(resolve(output, "simulation.json"), JSON.stringify({ contentRef: catalog.ref, samples, firstBattleSeed: spec.firstBattleSeed, summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
