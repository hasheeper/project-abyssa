import { build as esbuild, type BuildOptions, type BuildResult, type Plugin } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Browser probes and Node fixtures must load authored documents just as Vite does.
const rawImports: Plugin = {
  name: "fixture-raw-imports",
  setup(builder) {
    builder.onResolve({filter: /\?raw$/}, args => ({path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "fixture-document"}));
    builder.onLoad({filter: /.*/, namespace: "fixture-document"}, async args => ({contents: await readFile(args.path, "utf8"), loader: "text"}));
  },
};

export function build<T extends BuildOptions>(options: T & Record<Exclude<keyof T, keyof BuildOptions>, never>): Promise<BuildResult<T>> {
  return esbuild<T>({...options, plugins: [rawImports, ...options.plugins ?? []]});
}
