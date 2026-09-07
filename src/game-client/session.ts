import type { createBrowserGameRuntime } from "../game-runtime/browser";
import { sameHead } from "../game-runtime/views";
import type { AnyGameRecord as GameRecord, AnyReceipt as CommandReceipt, CommandRequest, GameCommand, DemoCommand, DemoRequest, D5Command, D5Request, ReceiptError } from "../game-application";
import type { createGameRuntime } from "../game-runtime/create-runtime";
import { parseVersionedRequest } from "../game-runtime/versioned-views";
export const activeRunId = (record: GameRecord) => record.schemaVersion !== 1 ? record.snapshot.campaign.activeRunRef?.id : record.snapshot.expedition?.id;
import type { RequestStorage } from "./pending-request";
import { clearVersionedPending as clearPending, readVersionedPending as readPending, writeVersionedPending as writePending } from "./versioned-pending-request";
import { locatorHasRun, locatorMatchesRun, type SaveLocator } from "./navigation";

export type ClientRuntime = ReturnType<typeof createBrowserGameRuntime> | ReturnType<typeof createGameRuntime>;
export type SessionState = { status: "loading" | "ready" | "submitting" | "recovering" | "error" | "disposed"; record: GameRecord | null; error: ReceiptError | null; generation: number };
export type CommittedBatch = { before: GameRecord; after: GameRecord; receipts: CommandReceipt[]; presentable: boolean };
export type SessionCommandPolicy = { continueRuns: false; commandTypes: readonly string[] };
const clientError = (code: string, message: string): ReceiptError => ({ code, path: "client", message });

/** Cache and command coordinator. It never resolves rules or writes a candidate snapshot. */
export class GameSession {
  private state: SessionState = { status: "loading", record: null, error: null, generation: 0 };
  private listeners = new Set<() => void>();
  private flight: Promise<CommittedBatch | null> | null = null;
  private disposed = false;
  private readVersion = 0;
  private externalChange = false;
  constructor(readonly runtime: ClientRuntime, readonly locator: SaveLocator, private readonly storage: RequestStorage,
    private readonly notifyCommit: (record: GameRecord) => void = () => {},
    private readonly commandPolicy?: SessionCommandPolicy) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SessionState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn());
  }
  private async read(): Promise<GameRecord> {
    const result = await this.runtime.application.open(this.locator.saveId);
    if (!result.ok) throw result.error;
    if (result.record.head.epoch !== this.locator.epoch) throw clientError("identity-mismatch", "档案身份已失效，请重新选择档案。");
    return result.record;
  }
  private error(error: unknown): ReceiptError {
    return error && typeof error === "object" && "code" in error ? error as ReceiptError : clientError("storage-unavailable", "无法保存或读取进度，请重试。");
  }
  async refresh({background = false}: {background?: boolean} = {}): Promise<void> {
    if (this.disposed) return;
    if (this.flight) { this.externalChange = true; return; }
    const version = ++this.readVersion;
    this.publish({ status: "loading", error: null, generation: this.state.generation + (background ? 0 : 1) });
    try {
      const loaded = await this.read();
      if (this.disposed || version !== this.readVersion) return;
      const previous = this.state.record;
      const unchanged = previous && sameHead(previous.head, loaded.head) && previous.contentRef.digest === loaded.contentRef.digest;
      const record = unchanged ? previous : loaded;
      this.publish({ record, status: "ready", generation: this.state.generation + (background && previous && !unchanged ? 1 : 0) });
      const pending = readPending(this.storage, record);
      // A stale battle URL must not consume an intent belonging to another run.
      const matchesRun = locatorMatchesRun(record, this.locator);
      const pendingStoryId = pending?.command.type === "acknowledge-story" ? pending.command.terminalId : null;
      const pendingStoryMatches = pendingStoryId !== null && (record.schemaVersion === 3 || record.schemaVersion === 4) && record.snapshot.campaign.settlements.some(t => t.id === pendingStoryId && t.runId === this.locator.expeditionId);
      const memory = record.schemaVersion === 4 ? record.snapshot.campaign.memory : null;
      const returnCommand = pending?.command;
      const committedReturn = pending && record.schemaVersion === 4 && record.commits.some(c => c.requestId === pending.clientRequestId && ["story-started", "story-advanced", "story-completed"].includes(c.kind));
      const pendingMemoryStoryMatches = !!(returnCommand && record.schemaVersion === 4 && memory && this.locator.memory?.id === memory.id && this.locator.memory.attempt === memory.attempt && (
        committedReturn || (returnCommand.type === "begin-story" ? returnCommand.eventId === "story.marietta.return" && returnCommand.basisId === record.snapshot.campaign.chapterCompletion?.id
          : (returnCommand.type === "advance-story" || returnCommand.type === "complete-story") && record.snapshot.campaign.stories.some(s => s.id === returnCommand.sessionId && s.eventId === "story.marietta.return"))
      ));
      const pendingMatches = pending && (!locatorHasRun(this.locator) || pendingStoryMatches || pendingMemoryStoryMatches || ("expeditionId" in pending.command ? pending.command.expeditionId === this.locator.expeditionId : "runRef" in pending.command && (pending.command.runRef.kind === "memory" ? this.locator.memory?.id === pending.command.runRef.id && this.locator.memory.attempt === pending.command.runRef.attempt : pending.command.runRef.id === this.locator.expeditionId)));
      if (pendingMatches && (!this.commandPolicy || this.commandPolicy.commandTypes.includes(pending.command.type))) await this.execute(pending, true);
      else if (!this.commandPolicy && matchesRun && this.runtime.queries.continuation(record)) await this.execute(null, true);
    } catch (error) { if (version === this.readVersion) this.publish({ status: "error", error: this.error(error) }); }
  }
  dispatch(command: Exclude<GameCommand | DemoCommand | D5Command, { type: "resume-enemy-turn" | "resume-run" }>): Promise<CommittedBatch | null> {
    if (this.commandPolicy && !this.commandPolicy.commandTypes.includes(command.type)) return Promise.resolve(null);
    if (this.flight) return this.flight;
    if (this.disposed || this.state.status !== "ready" || !this.state.record) return Promise.resolve(null);
    if (this.commandPolicy) {
      const pending = readPending(this.storage, this.state.record);
      if (pending && !this.commandPolicy.commandTypes.includes(pending.command.type)) {
        this.publish({ status: "error", error: clientError("pending-other-command", "请先返回原页面恢复尚未确认的操作。") });
        return Promise.resolve(null);
      }
    }
    return this.execute(parseVersionedRequest({ protocolVersion: this.state.record.schemaVersion, saveId: this.locator.saveId, expectedHead: this.state.record.head, clientRequestId: this.runtime.newId(), command }), false);
  }
  private execute(request: CommandRequest | DemoRequest | D5Request | null, recovering: boolean): Promise<CommittedBatch | null> {
    if (this.flight) return this.flight;
    const before = this.state.record!;
    this.publish({ status: recovering ? "recovering" : "submitting", error: null });
    this.externalChange = false;
    const task = (async () => {
      const receipts: CommandReceipt[] = [];
      let current = before, next = request ?? this.runtime.queries.continuation(current), presentable = !recovering;
      try {
        for (let steps = 0; next; steps++) {
          if (this.disposed) return null;
          // Yield between bounded batches; every automatic step must advance the committed head.
          if (steps && steps % 8 === 0 && typeof MessageChannel !== "undefined") await new Promise<void>(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => {channel.port1.close(); channel.port2.close(); resolve();}; channel.port2.postMessage(null); });
          writePending(this.storage, next);
          const result = ["resume-enemy-turn", "resume-run"].includes(next.command.type) ? await this.runtime.application.resumeEnemyTurn(next) : await this.runtime.application.dispatch(next);
          if (result.ok || "receipt" in result && result.receipt) clearPending(this.storage, current);
          if (!result.ok) {
            current = await this.read();
            this.publish({ record: current });
            // Only automatic continuation conflicts can safely be reclassified.
            if (recovering && next.clientRequestId.startsWith("resume:") && result.error.code === "conflict") {
              next = locatorMatchesRun(current, this.locator) ? this.runtime.queries.continuation(current) : null;
              presentable = false; continue;
            }
            throw result.error;
          }
          receipts.push(result.receipt);
          presentable &&= !result.replayed && sameHead(current.head, result.receipt.before);
          const previousHead = current.head;
          current = await this.read();
          if (!result.replayed && sameHead(previousHead, current.head) && next.clientRequestId.startsWith("resume:")) throw clientError("resume-stalled", "流程没有推进，请导出诊断记录。");
          presentable &&= sameHead(current.head, result.receipt.after);
          this.notifyCommit(current);
          // Never continue a different expedition after another tab has moved on.
          if (locatorHasRun(this.locator) && !locatorMatchesRun(current, this.locator)) break;
          next = this.commandPolicy ? null : this.runtime.queries.continuation(current);
        }
        if (this.disposed) return null;
        this.publish({ record: current, status: "ready" });
        return { before, after: current, receipts, presentable: presentable && !this.externalChange };
      } catch (error) {
        this.publish({ status: "error", error: this.error(error), generation: this.state.generation + 1 });
        return null;
      }
    })();
    this.flight = task;
    void task.finally(() => {
      if (this.flight === task) this.flight = null;
      if (this.externalChange && !this.disposed) { this.externalChange = false; void this.refresh({background:true}); }
    });
    return task;
  }
  dispose() {
    this.disposed = true; this.readVersion++;
    this.state = { ...this.state, status: "disposed", generation: this.state.generation + 1 };
    this.listeners.clear(); this.runtime.close();
  }
}
