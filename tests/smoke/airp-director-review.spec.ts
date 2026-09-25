import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test("GM REVIEW LIVE renamed duplicate and same-character different task", async ({page}, info) => {
  test.skip(process.env.ABYSSA_AIRP_GM_LIVE !== "1", "Explicit live acceptance only");
  const bundled = await build({entryPoints: ["src/game-application/testing/airp-director-review-cases.ts"], bundle: true, write: false, platform: "node", format: "esm", plugins: [{name: "author-raw", setup(b) {
    b.onResolve({filter: /\?raw$/}, args => ({path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "author-raw"}));
    b.onLoad({filter: /.*/, namespace: "author-raw"}, args => ({contents: readFileSync(args.path, "utf8"), loader: "text"}));
  }}]});
  const fixture = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const config = JSON.parse(readFileSync("config/airp-test.local.json", "utf8"));
  const c = {...config.connection, ...config.models.planning};
  await page.goto("/");
  const evidence = [];
  for (const sample of fixture.directorSemanticCases()) {
    const response = await page.evaluate(async ({c, messages}) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), c.timeoutMs ?? 180000);
      try {
        const url = c.baseUrl.replace(/\/+$/, "");
        const r = await fetch(url.endsWith("/chat/completions") ? url : `${url}/chat/completions`, {method: "POST", mode: "cors", credentials: "omit", redirect: "error", signal: controller.signal,
          headers: {"Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}`}, body: JSON.stringify({model: c.model, messages, stream: false})});
        if (!r.ok) return {status: r.status};
        const body = await r.json(); return {status: r.status, output: body.choices?.[0]?.message?.content, finish: body.choices?.[0]?.finish_reason, usage: body.usage};
      } catch {return {status: "network-or-timeout"};} finally {clearTimeout(timer);}
    }, {c, messages: sample.input.messages});
    evidence.push({expected: sample.expected, planHash: sample.planHash, ...response});
  }
  const serialized = JSON.stringify({kind: "controlled-live-semantic-review-not-gameplay", model: c.model, calls: evidence.length, cases: evidence}, null, 2);
  if (serialized.includes(c.apiKey) || serialized.includes(c.baseUrl)) throw Error("Sensitive data in semantic evidence");
  writeFileSync(info.outputPath("semantic-evidence.json"), serialized);
  await page.close();
  for (const result of evidence) {
    expect(result.status).toBe(200); expect(result.finish).toBe("stop");
    const review = fixture.parseDirectorReview(JSON.parse(result.output));
    expect(review.planHash).toBe(result.planHash);
    expect(review.decisions).toHaveLength(1); expect(review.decisions[0].verdict).toBe(result.expected);
    if (result.expected === "same") {
      expect(review.decisions[0].matchedSourceIds).toContain("past-tea");
      expect(review.decisions[0].matchedSourceIds.every((id: string) => ["past-tea", "ripple.kororo.quiet-cup"].includes(id))).toBe(true);
    } else expect(review.decisions[0].matchedSourceIds).toEqual([]);
  }
});
