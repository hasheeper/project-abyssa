import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RpMessage } from "../rp-stage";

const STICK_THRESHOLD = 48;

/** 跟随新消息；用户主动回看后暂停，直到回到底部或点击跳转按钮。 */
export function useRpAutoScroll(messages: readonly RpMessage[]) {
  const logRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const stickRef = useRef(true);
  useLayoutEffect(() => {
    const log=logRef.current;
    // Restoring RP must land on the current line before paint, not scroll through the whole script.
    if(log) log.scrollTop=log.scrollHeight;
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || typeof ResizeObserver === "undefined") return;
    // Dock height changes are layout events, not new messages. Preserve a reader's history position.
    const observer = new ResizeObserver(() => {if (stickRef.current) log.scrollTop = log.scrollHeight;});
    observer.observe(log);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < STICK_THRESHOLD;
    setStick(stickRef.current);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || !stick) return;
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, stick]);

  const jumpToLatest = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    stickRef.current = true;
    setStick(true);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, []);

  return { logRef, stick, onScroll, jumpToLatest };
}
