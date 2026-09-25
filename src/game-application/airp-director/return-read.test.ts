import { expect, it } from "vitest";
import { relatedDirectorRead, type DirectorSettlementReads } from "./settlement-context";

it("includes every read paragraph in the associated run, including unbound nodes and private narration", () => {
  const line = (sourceId: string, knownBy: string[], text: string) => ({ sourceId, sceneId: sourceId.split(":")[0], knownBy, text });
  const entry = line("entry:0", ["kael"], "入口原旁白，不代表其他人都知道。"),
    target = line("target:0", ["kael", "elora"], "艾洛拉随队确认旧药箱。"),
    exit = line("exit:0", ["kael"], "出口原旁白，与回馆前的末尾衔接。"),
    unrelated = line("another:0", ["kael", "elora"], "另一趟探索，不应混入。"),
    earlier = line("offer:0", ["kael", "elora"], "原委托正文，仍保持全文。");
  const reads: DirectorSettlementReads = [
    { eventId: "event:1", runId: null, lines: [earlier] },
    { eventId: null, runId: "run:1", lines: [entry] },
    { eventId: "event:1", runId: "run:1", lines: [target] },
    { eventId: null, runId: "run:1", lines: [exit] },
    { eventId: null, runId: "run:2", lines: [unrelated] },
    { eventId: "event:1", runId: "run:1", lines: [target] },
  ];
  const frozen = structuredClone(reads);
  expect(relatedDirectorRead(reads, "event:1", "run:1")).toEqual([earlier, entry, target, exit]);
  expect(relatedDirectorRead(reads, "event:1", null)).toEqual([earlier, target]);
  expect(reads).toEqual(frozen);
  expect(relatedDirectorRead(reads, "event:2", null)).toEqual([]);
});
