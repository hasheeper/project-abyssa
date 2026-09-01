import { useCallback, useEffect, useRef, useState } from "react";
import { randomItem } from "../game";
import type { MoodKey, Side } from "../game";
import type { CoinTransfer } from "../components/TableStatus";

export interface DiceDialogueState {
  text: string;
  mood: MoodKey;
  key: number;
}

export interface DiceBannerState {
  title: string;
  subtitle: string;
  visible: boolean;
}

export function useDicePresentation() {
  const bannerTimerRef = useRef<number | null>(null);
  const coinTransferIdRef = useRef(0);
  const [dialogue, setDialogue] = useState<DiceDialogueState>({
    text: "一局定胜负。你只需要让我看见你愿意公开的部分~",
    mood: "amused",
    key: 0,
  });
  const [banner, setBanner] = useState<DiceBannerState>({
    title: "",
    subtitle: "",
    visible: false,
  });
  const [coinTransfer, setCoinTransfer] = useState<CoinTransfer | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const say = useCallback(
    (source: readonly string[] | string, mood: MoodKey = "calm") => {
      const text = typeof source === "string" ? source : randomItem(source);
      setDialogue((current) => ({ text, mood, key: current.key + 1 }));
    },
    [],
  );

  const showBanner = useCallback((title: string, subtitle: string) => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    setBanner({ title, subtitle, visible: true });
    bannerTimerRef.current = window.setTimeout(() => {
      setBanner((current) => ({ ...current, visible: false }));
    }, 920);
  }, []);

  const transferCoins = useCallback((side: Side, amount: number) => {
    coinTransferIdRef.current += 1;
    setCoinTransfer({
      id: coinTransferIdRef.current,
      side,
      amount,
    });
  }, []);

  const clearCoinTransfer = useCallback(() => {
    setCoinTransfer(null);
  }, []);

  return {
    dialogue,
    banner,
    coinTransfer,
    say,
    showBanner,
    transferCoins,
    clearCoinTransfer,
  };
}
