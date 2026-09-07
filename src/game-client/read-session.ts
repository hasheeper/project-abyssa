import type { AnyGameRecord, ReceiptError } from "../game-application";
import type { createBrowserGameReader } from "../game-runtime/browser-reader";
import type { SaveLocator } from "./navigation";

export type GameReader = ReturnType<typeof createBrowserGameReader>;
export type ReadSessionState = {
  status: "loading" | "ready" | "error" | "disposed";
  record: AnyGameRecord | null;
  error: ReceiptError | null;
};

/** A read capability in the game-client session system. No request storage or dispatcher. */
export class ReadGameSession {
  private state: ReadSessionState = {
    status: "loading",
    record: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private disposed = false;
  constructor(
    readonly runtime: GameReader,
    readonly locator: SaveLocator,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<ReadSessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async refresh() {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.publish({ status: "loading", error: null });
    try {
      const result = await this.runtime.open(this.locator.saveId);
      if (this.disposed || generation !== this.generation) return;
      if (!result.ok) throw result.error;
      if (
        result.record.head.saveId !== this.locator.saveId ||
        result.record.head.epoch !== this.locator.epoch
      )
        throw {
          code: "identity-mismatch",
          path: "head",
          message: "档案身份已变化",
        };
      // Committed heads are immutable. Retain the read model identity after a
      // validated refresh of the same head, so focus/visibility does not rebuild it.
      const previous = this.state.record;
      const record =
        previous?.head.revision === result.record.head.revision &&
        previous.contentRef.digest === result.record.contentRef.digest
          ? previous
          : result.record;
      this.publish({ status: "ready", record, error: null });
    } catch (reason) {
      if (this.disposed || generation !== this.generation) return;
      const error: ReceiptError =
        reason && typeof reason === "object" && "code" in reason
          ? (reason as ReceiptError)
          : { code: "storage-unavailable", path: "read", message: "读取失败" };
      const invalid = ![
        "storage-unavailable",
        "storage-blocked",
        "storage-aborted",
        "storage-quota",
      ].includes(error.code);
      this.publish({
        status: "error",
        error,
        ...(invalid ? { record: null } : {}),
      });
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.publish({ status: "disposed", record: null });
    this.listeners.clear();
    this.runtime.close();
  }
}
