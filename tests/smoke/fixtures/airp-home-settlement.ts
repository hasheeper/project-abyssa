import { formalHomeFixture } from "../../../src/game-application/testing/airp-home-fixture";
export async function homeSettlementArchive() {
  const f = await formalHomeFixture("action"), record = f.raw();
  const exported = await f.runtime.application.exportSave(record.head.saveId);
  if (!exported.ok) throw Error("Home fixture export failed");
  const settlementId = await f.flow.settleHome();
  await f.flow.settlement.begin(settlementId, { id: "interrupted-home", model: "fixture", connectionHash: "3".repeat(64), at: 1 });
  const interrupted = await f.runtime.application.exportSave(record.head.saveId);
  if (!interrupted.ok) throw Error("Interrupted home fixture export failed");
  return { archive: exported.archive, interruptedArchive: interrupted.archive, saveId: record.head.saveId, epoch: record.head.epoch,
    title: record.airpDirector!.events[0].card.title };
}
