import { useEffect, useState, useSyncExternalStore } from "react";
import { createBrowserGameRuntime } from "../game-runtime/browser";
import { GameSession, type SessionState, type SessionCommandPolicy } from "./session";
import { observeCommits } from "./observe-commits";
import { useReadSession, useReadState } from "./read-react";

export const EQUIPMENT_COMMAND_POLICY = {continueRuns:false as const, commandTypes:["equip-equipment","unequip-equipment","transfer-equipment"]};
const idle: SessionState = {status:"loading",record:null,error:null,generation:0};
const idleSnapshot = () => idle;
const noSubscribe = () => () => {};

/** Separate finite write capability. Viewing an archive never resumes a battle or a pending story. */
export function useEquipmentSession(policy: SessionCommandPolicy = EQUIPMENT_COMMAND_POLICY) {
  const reader = useReadSession(), {record} = useReadState();
  const enabled = record?.schemaVersion === 4;
  const [writer, setWriter] = useState<GameSession | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const locator = {saveId:reader.locator.saveId,epoch:reader.locator.epoch};
    let observer: ReturnType<typeof observeCommits> | undefined;
    let session: GameSession | undefined, cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const instance = new GameSession(createBrowserGameRuntime(),locator,window.sessionStorage,after => {
        observer?.notify(after.head);void reader.refresh();
      },policy);
      session = instance;
      observer = observeCommits(locator,() => instance.refresh({background:true}));
      setWriter(instance);void instance.refresh();
    });
    return () => {cancelled = true;observer?.close();session?.dispose();setWriter(null);};
  },[enabled,reader,policy]);
  const state = useSyncExternalStore(writer?.subscribe ?? noSubscribe,writer?.getSnapshot ?? idleSnapshot);
  return {writer,state};
}
