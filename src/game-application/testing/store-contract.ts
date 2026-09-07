import type { GameStorePort } from "../contracts";
import {
  appFor,
  creation,
  ensure,
  opened,
  request,
  startCommand,
  terminal,
} from "./helpers";
/** The same complete contract runs against memory in Node and two actual IDB connections in Chromium. */
export async function runStoreContract(
  first: GameStorePort,
  second: GameStorePort,
) {
  const a = appFor(first),
    b = appFor(second);
  ensure((await a.create(creation())).ok, "create");
  const initial = await opened(a),
    start = request(initial, startCommand, "start");
  const raced = await Promise.all([
    a.dispatch(start),
    b.dispatch({ ...start, clientRequestId: "other-start" }),
  ]);
  ensure(
    raced.filter((r) => r.ok).length === 1,
    "CAS must accept exactly one request",
  );
  const winner = raced[0].ok
      ? start
      : { ...start, clientRequestId: "other-start" },
    loser = raced[0].ok ? { ...start, clientRequestId: "other-start" } : start;
  const replay = await b.dispatch(winner);
  ensure(replay.ok && replay.replayed, "success receipt retry");
  const conflict = await a.dispatch(loser);
  ensure(!conflict.ok && conflict.error.code === "conflict", "stable conflict");
  const changed = await a.dispatch({
    ...winner,
    command: { ...startCommand, seed: 20 },
  });
  ensure(!changed.ok && changed.error.code === "request-id-reused", "ID reuse");
  const before = await opened(b),
    rejected = request(
      before,
      {
        type: "battle-command",
        expeditionId: "run",
        command: { type: "next-round" },
      },
      "reject",
    );
  const bad = await a.dispatch(rejected);
  ensure(!bad.ok, "domain rejection");
  ensure(
    JSON.stringify(await opened(b)) === JSON.stringify(before),
    "rejection changed state/RNG",
  );
  const finish = await terminal(b);
  ensure(
    finish.snapshot.expedition?.lifecycle.type === "finished" &&
      finish.snapshot.expedition.lifecycle.result.totalGold > 0,
    "real winning rules must produce a positive payout",
  );
  ensure(finish.pendingSettlement, "terminal candidate");
  const settle = request(
    finish,
    {
      type: "settle-expedition",
      expeditionId: "run",
      terminalRef: finish.pendingSettlement.terminalRef,
    },
    "settle",
  );
  const settled = await a.dispatch(settle);
  ensure(settled.ok, "settle");
  const final = await opened(b);
  ensure(
    final.snapshot.expedition === null &&
      final.snapshot.campaign.appliedSettlements.length === 1,
    "atomic ledger and close",
  );
  const retry = await b.dispatch(settle);
  ensure(retry.ok && retry.replayed, "lost response retry");
  const duplicate = await a.dispatch(
    request(final, settle.command, "settle-again"),
  );
  ensure(
    !duplicate.ok && duplicate.error.code === "already-settled",
    "new ID cannot pay twice",
  );
  ensure(
    JSON.stringify(await opened(a)) === JSON.stringify(final),
    "duplicate changed assets",
  );
  ensure(
    (await a.dispatch(rejected)).ok === false,
    "old rejection must persist after progress",
  );
  return {
    revision: final.head.revision,
    settlements: final.snapshot.campaign.appliedSettlements.length,
    facts: final.facts.length,
    funds: final.snapshot.campaign.funds,
  };
}
