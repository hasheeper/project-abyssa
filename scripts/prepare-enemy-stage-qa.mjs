/** Valid application archives for manual UI acceptance on a separate localhost origin.
 * No browser/database access; no production rules or saves are modified. */
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "../config/paths.mjs";

const output = resolve(projectRoot, "dist/reports/enemy-stage");
await mkdir(output, {recursive:true});
const outfile = resolve(output, "fixture.mjs");
await build({absWorkingDir:projectRoot, entryPoints:["src/game-client/testing/chapter-one.ts"], outfile, bundle:true, format:"esm", platform:"node", target:"es2022"});
const {chapterOneFixtures} = await import(pathToFileURL(outfile).href);
const {archives} = await chapterOneFixtures();
for (const [key, archive] of Object.entries(archives)) {
  if (key.startsWith("battle-")) {
    const path = resolve(output, `${key}.json`);
    await writeFile(path, archive);
    console.log(path);
  }
}
