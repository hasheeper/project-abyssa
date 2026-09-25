import { useState } from "react";
import { serializeCallLog, type CallLogEntry } from "../../game-runtime/airp-call-log";
import { JournalButton } from "../JournalPrimitives";
import { downloadJson } from "../react";

export function CallLog({ entries, warnings = [] }: { entries: CallLogEntry[]; warnings?: string[] }) {
  const [open, setOpen] = useState(false);
  return <details className="airp-direct-details airp-direct-diagnostics" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>调用记录 · {entries.length}</summary>
    {open && <>
      <JournalButton disabled={!entries.length} onClick={() => downloadJson(serializeCallLog(entries, warnings), "airp-call-log.json")}>导出调用日志</JournalButton>
      {warnings.length > 0 && <pre>{warnings.join("\n")}</pre>}
      {entries.map(a => <details key={a.id}>
        <summary>{a.stage} · {a.status} · {a.model} · tokens {a.usage.totalTokens ?? "未知"}</summary>
        <pre>{serializeCallLog([a])}</pre>
      </details>)}
    </>}
  </details>;
}
