import { tideClientFixture, tideCommand, tideOperation } from "./tide-cave";

/** Real application playthrough for browser acceptance, never part of production. */
export async function chapterOneFixtures() {
  const f = await tideClientFixture(12), archives: Record<string,string> = {};
  try {
    await f.start();
    for (let step = 0; step < 350; step++) {
      const record = f.session.getSnapshot().record!;
      if (record.schemaVersion !== 4 || record.snapshot.run?.kind !== "expedition") throw Error("Missing chapter-one expedition");
      const run = record.snapshot.run.state, tutorial = run.tutorial!;
      const encounter = f.runtime.queries.tutorial(record)!.encounter;
      if (tutorial.story && !archives[tutorial.story.id]) archives[tutorial.story.id] = await f.archive();
      if (!tutorial.story && run.node === "battle" && !archives[`battle-${encounter}`]) archives[`battle-${encounter}`] = await f.archive();
      if (run.node === "event" && !archives.event) archives.event = await f.archive();
      if (tutorial.stage === "claimable") {
        archives.claimable = await f.archive();
        await f.send({type:"settle-expedition",runRef:{kind:"expedition",id:run.run.id},terminalRef:run.result!.id});
        archives.home = await f.archive();
        return {archives, record:f.session.getSnapshot().record!};
      }
      const operation = tideOperation(record);
      if (!operation || operation.type === "resume") throw Error(`Unexpected chapter fixture stop ${step}`);
      await f.send(tideCommand(operation));
    }
    throw Error("Chapter-one fixture did not finish");
  } finally {f.session.dispose();}
}
