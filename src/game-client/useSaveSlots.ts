import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserSaveSlots, initialSaveSlots, type SaveSlotIndex } from "../game-runtime/save-slots";
import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";

export function useSaveSlots(saves: PlayerSaveListEntry[]) {
  const [stored, setStored] = useState<SaveSlotIndex | null | undefined>();
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setStored(undefined); setError("");
    try {
      const result = await browserSaveSlots.read();
      if (version === generation.current) setStored(result);
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message : "槽位目录暂不可用，请重试。");
    }
  }, []);
  useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
  return {
    index: useMemo(() => stored === undefined ? null : stored ?? initialSaveSlots(saves), [stored, saves]),
    error, reload, setIndex: setStored,
  };
}
