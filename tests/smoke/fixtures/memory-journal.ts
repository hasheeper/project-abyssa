import { formalAirpFixture, formalNodeText, formalRead, formalSettle } from "../../../src/game-application/testing/airp-game-fixture";

/** Saved mock responses exercise the production reader without contacting a provider. */
export async function memoryJournalArchive() {
  const f = await formalAirpFixture("old-manor.maintenance", 28);
  const planId = await f.prepare(), permit = await f.flow.gm.departurePermit(planId);
  await f.send({ type: "start-expedition", ...permit.departure }); await f.flow.sync();
  const jobId = (await f.flow.nodes.read()).ledger.jobs[0].id;
  await formalNodeText(f, jobId); await formalRead(f, jobId);
  await formalSettle(f, jobId);
  const record = f.raw(), data = f.runtime.queries.memoryJournal(record);
  if (data.status !== "ready" || data.entries.length !== 1) throw Error("Expected one proven expedition event");
  const exported = await f.runtime.application.exportSave(record.head.saveId);
  if (!exported.ok) throw Error("Journal fixture export failed");
  return { archive: exported.archive, title: data.entries[0].title, summary: data.entries[0].summary,
    firstLine: data.entries[0].blocks[0].text, saveId: record.head.saveId, epoch: record.head.epoch };
}
