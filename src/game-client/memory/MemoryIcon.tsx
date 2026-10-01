import { useMemo } from "react";
import type { MemoryEntry } from "./memory-types";
import { resolveMemoryIcon } from "./memory-icon";
import "./memory-icon.css";

export function MemoryIcon({ entry }: { entry: MemoryEntry }) {
  const match = useMemo(() => resolveMemoryIcon(entry), [entry]);
  const mask = `url("${match.assetUrl}")`;
  return <span className="memory-icon" aria-hidden="true" data-memory-icon-source={match.entry.id}>
    <i className="memory-icon__mask" style={{ maskImage: mask, WebkitMaskImage: mask }}/>
  </span>;
}
