import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RpMessage } from "../rp-stage";

const STICK_THRESHOLD = 48;

/** 跟随新消息；用户主动回看后暂停，直到回到底部或点击跳转按钮。 */
export function useRpAutoScroll(messages: readonly RpMessage[]) {
  const logRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  useLayoutEffect(() => {
    const log=logRef.current;
    // Restoring RP must land on the current line before paint, not scroll through the whole script.
    if(log) log.scrollTop=log.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    setStick(log.scrollHeight - log.scrollTop - log.clientHeight < STICK_THRESHOLD);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || !stick) return;
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, stick]);

  const jumpToLatest = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    setStick(true);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, []);

  return { logRef, stick, onScroll, jumpToLatest };
}
