import { build as esbuild, type BuildOptions, type BuildResult, type Plugin } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Browser probes and Node fixtures must load authored documents just as Vite does.
const rawImports: Plugin = {
  name: "fixture-raw-imports",
  setup(builder) {
    builder.onResolve({filter: /\?raw$/}, args => ({path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "fixture-document"}));
    builder.onLoad({filter: /.*/, namespace: "fixture-document"}, async args => ({contents: await readFile(args.path, "utf8"), loader: "text"}));
    // The journal shares prologue presentation with Vite. Node fixtures need
    // the same eager image imports, rather than a fake import.meta.glob function.
    builder.onLoad({filter: /content\/presentation\/prologue\.ts$/}, async args => {
      const folder = "../../assets/cg/prologue/", files = (await readdir(resolve(dirname(args.path), folder))).filter(file => file.endsWith(".webp")).sort();
      const imports = files.map((file, i) => `import prologueCg${i} from ${JSON.stringify(folder + file)};`).join("\n");
      const entries = files.map((file, i) => `${JSON.stringify(folder + file)}:prologueCg${i}`).join(",");
      const source = await readFile(args.path, "utf8");
      return { contents: imports + "\n" + source.replace(/import\.meta\.glob<string>\([^;]+\)/, `{${entries}}`), loader: "ts" };
    });
  },
};

export function build<T extends BuildOptions>(options: T & Record<Exclude<keyof T, keyof BuildOptions>, never>): Promise<BuildResult<T>> {
  return esbuild<T>({...options, plugins: [rawImports, ...options.plugins ?? []]});
}
