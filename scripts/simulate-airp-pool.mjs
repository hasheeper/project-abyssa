import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../config/paths.mjs";

const directory = resolve(projectRoot, "dist/reports/airp-3");
mkdirSync(directory, { recursive: true });
const outfile = resolve(directory, "simulation-runtime.mjs");
await build({ absWorkingDir: projectRoot, stdin: { contents: 'export { AIRP_POOL_CONTENT } from "./src/content/gameplay/airp-v2/content"; export * from "./src/game-core/session/airp-pool";', resolveDir: projectRoot }, outfile, bundle: true, format: "esm", platform: "node" });
const m = await import(pathToFileURL(outfile).href), content = m.AIRP_POOL_CONTENT;
function simulate(policy) {
  const state = m.emptyAirpPool(), timeline = []; let emptyPhases = 0, first64 = null;
  for (let phase = 0; phase <= 272; phase++) {
    const head = { saveId: "scheduler-simulation", epoch: policy, revision: phase }, factId = `boundary:${phase}`;
    const count = state.instances.length;
    m.expireAirpPool(content, state, phase, head, factId);
    m.scheduleAirpPool(content, state, { phase, phaseName: ["dawn", "day", "dusk", "night"][phase % 4], head, factId, eligible: true, availableActorIds: Object.keys(content.availability), setback: false });
    const active = state.instances.filter(m.airpPoolActive);
    if (!active.length) emptyPhases++;
    if (active.length > 4 || state.daily.offers > 4 || new Set(active.map(i => content.cards.find(d => d.id === i.definition.id).objective.form)).size !== active.length) throw Error("Quota invariant failed");
    const offered = state.instances.slice(count).map(i => ({ id: i.id, definitionId: i.definition.id, variant: i.variant }));
    if (policy === "complete-immediately") {
      // Synthetic terminal policy isolates scheduling. It is not a game archive,
      // does not prove quest objectives, and cannot be restored by the player.
      for (const i of active) { i.status = "resolved"; i.resolvedPhase = phase; m.poolCooldown(state, content.cards.find(d => d.id === i.definition.id), phase, `synthetic-terminal:${i.id}`); }
    }
    const size = m.checkAirpPoolCapacity(state);
    timeline.push({ phase, offered, reserve: state.reserve.length, active: active.length, cooldowns: state.cooldowns.filter(c => c.untilPhase > phase).length, capacityStopped: state.capacityStopped });
    if (phase === 255) first64 = { instances: state.instances.length, memories: state.memories.length, archiveProjectionBytes: size.totalBytes, emptyPhases };
  }
  for (const d of content.cards) {
    const instances = state.instances.filter(i => i.definition.id === d.id);
    if (policy === "complete-immediately") for (let n = 1; n < instances.length; n++) if (instances[n].createdPhase - instances[n - 1].resolvedPhase < 256 || d.repeat === "once") throw Error("Early repeat");
  }
  return { policy, first64, extension: { throughPhase: 272, instances: state.instances.length, emptyPhases }, timeline };
}
const scenarios = [simulate("ignore-all"), simulate("complete-immediately")];
const report = { scope: "Scheduler-only synthetic policies; 64 days plus 17 phases to observe cooldown release. Not gameplay/save proof or player-duration measurement.", configuration: content.scheduler, scenarios };
writeFileSync(resolve(directory, "64-day-simulation.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ path: resolve(directory, "64-day-simulation.json"), scenarios: scenarios.map(({ timeline: _, ...summary }) => summary) }, null, 2));
