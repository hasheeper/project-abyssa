/** Test-only probe: validates played records and inspects the production queries. */
export { seedPlayed } from "./memory-browser";
import { createBrowserGameRuntime } from "../browser";
import type { D5Command } from "../../game-application";

export async function inspectGrowth() {
  const runtime = createBrowserGameRuntime();
  try {
    const result = await runtime.application.open("d5-d");
    if (!result.ok || result.record.schemaVersion !== 4) throw Error(JSON.stringify(result));
    return {record:result.record, progression:runtime.queries.progression(result.record), archive:runtime.queries.archive(result.record), party:runtime.queries.party(result.record)};
  } finally {runtime.close();}
}
export async function lostReceipt(command: D5Command) {
  const runtime = createBrowserGameRuntime();
  try {
    const result = await runtime.application.open("d5-d");
    if (!result.ok) throw Error(JSON.stringify(result));
    const request = {protocolVersion:4,saveId:"d5-d",expectedHead:result.record.head,clientRequestId:"e-lost-receipt",command};
    sessionStorage.setItem("abyssa:pending:v4:d5-d:epoch",JSON.stringify(request));
    const committed = await runtime.application.dispatch(request);
    if (!committed.ok) throw Error(JSON.stringify(committed));
  } finally {runtime.close();}
}
