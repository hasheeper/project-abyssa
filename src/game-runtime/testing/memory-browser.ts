/** Test-only browser tools; absent from all production entry graphs. */
import { createBrowserGameRuntime } from "../browser";
import { D5_FOUNDATION_CATALOG } from "../d5-foundation";
import { validateD5Record } from "../../game-application/versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import { IndexedDbGameStore } from "../../game-infrastructure/storage/indexeddb";
import { createD5Application } from "../../game-application/versions/d5-service";
import type { D5Command, D5GameRecord, D5Receipt } from "../../game-application/versions/d5-contracts";

export async function seedPlayed(raw: unknown, databaseName = "abyssa-game-v1") {
  const record = validateD5Record(raw,D5_FOUNDATION_CATALOG,D5_RUN_READERS);
  const store = new IndexedDbGameStore<D5GameRecord,D5Receipt>(databaseName);
  await store.listSaveIds(); store.close();
  await new Promise<void>((resolve,reject) => {
    const open = indexedDB.open(databaseName,1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(["saves","receipts"],"readwrite");
      tx.objectStore("saves").put(record,record.head.saveId);
      tx.objectStore("receipts").clear();
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onabort = () => {db.close(); reject(tx.error);};
    };
  });
}
export async function inspectMemory() {
  const runtime = createBrowserGameRuntime();
  try {
    const result = await runtime.application.open("d5-d");
    if (!result.ok || result.record.schemaVersion !== 4) throw Error(JSON.stringify(result));
    return {record:result.record, memory:runtime.queries.memory(result.record), journey:runtime.queries.journey(result.record)};
  } finally {runtime.close();}
}
export async function transact(command: D5Command) {
  const runtime = createBrowserGameRuntime();
  try {
    const r = await runtime.application.open("d5-d"); if (!r.ok) throw Error(JSON.stringify(r));
    const request = {protocolVersion:4,saveId:"d5-d",expectedHead:r.record.head,clientRequestId:crypto.randomUUID(),command};
    return await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn : runtime.application.dispatch)(request);
  } finally {runtime.close();}
}
export async function storageClaim(record: D5GameRecord) {
  const name = "d5-result-contract";
  await seedPlayed(record,name);
  const a = new IndexedDbGameStore<D5GameRecord,D5Receipt>(name), b = new IndexedDbGameStore<D5GameRecord,D5Receipt>(name);
  const first = createD5Application(D5_FOUNDATION_CATALOG,a), second = createD5Application(D5_FOUNDATION_CATALOG,b);
  const request = {protocolVersion:4,saveId:record.head.saveId,expectedHead:record.head,clientRequestId:"browser-claim",command:{type:"complete-story",sessionId:record.snapshot.campaign.activeStoryId!}};
  try {
    const committed = await first.dispatch(request);
    a.close();
    const replay = await second.dispatch(request), stale = await second.dispatch({...request,clientRequestId:"browser-stale"});
    b.close();
    const reopened = await first.open(record.head.saveId);
    return {committed,replay,stale,reopened};
  } finally {a.close();b.close();}
}

export async function claimWithLostReceipt() {
  const runtime = createBrowserGameRuntime();
  try {
    const r = await runtime.application.open("d5-d");
    if (!r.ok || r.record.schemaVersion !== 4) throw Error("No D5 result");
    const request = {protocolVersion:4,saveId:"d5-d",expectedHead:r.record.head,clientRequestId:"lost-ui-claim",command:{type:"complete-story",sessionId:r.record.snapshot.campaign.activeStoryId!}};
    sessionStorage.setItem("abyssa:pending:v4:d5-d:epoch",JSON.stringify(request));
    const result = await runtime.application.dispatch(request);
    if (!result.ok) throw Error(JSON.stringify(result));
    // Browser reload now sees the durable result and the client request whose response was lost.
  } finally {runtime.close();}
}
