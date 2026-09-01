import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDiceRuntimePort,
  type BattleReportStage,
  type DiceRuntimePort,
  type DiceRuntimeReadiness,
  type RealtimeDecision,
  type RealtimeDecisionInput,
} from "./dice-runtime";

export interface DiceReportState {
  status: "idle" | "running" | "completed" | "failed";
  stage: BattleReportStage | null;
  report: string;
  proposal: string;
  error: string;
}

export type DiceRuntimeState =
  | DiceRuntimeReadiness
  | { state: "checking" };

function createIdleReport(): DiceReportState {
  return {
    status: "idle",
    stage: null,
    report: "",
    proposal: "",
    error: "",
  };
}

export function useDiceRuntime() {
  const runtimeRef = useRef<DiceRuntimePort | null | undefined>(undefined);
  if (runtimeRef.current === undefined) {
    runtimeRef.current = createDiceRuntimePort();
  }
  const runtime = runtimeRef.current;
  const runtimeReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const reportRunningRef = useRef(false);
  const [runtimeState, setRuntimeState] = useState<DiceRuntimeState>(() =>
    runtime
      ? { state: "checking" }
      : { state: "unavailable", message: "Runtime is disabled." },
  );
  const [report, setReport] = useState<DiceReportState>(createIdleReport);

  useEffect(() => {
    mountedRef.current = true;
    if (runtime) {
      void runtime.checkReadiness().then((readiness) => {
        if (!mountedRef.current) return;
        runtimeReadyRef.current = readiness.state === "ready";
        setRuntimeState(readiness);
      });
    }
    return () => {
      mountedRef.current = false;
      runtimeReadyRef.current = false;
      reportRunningRef.current = false;
      runtime?.dispose();
    };
  }, [runtime]);

  const resetReport = useCallback(() => {
    reportRunningRef.current = false;
    setReport(createIdleReport());
  }, []);

  const decideRealtime = useCallback(
    (input: RealtimeDecisionInput): Promise<RealtimeDecision | null> => {
      if (!runtimeReadyRef.current || !runtime) {
        return Promise.resolve(null);
      }
      return runtime.decideRealtime(input);
    },
    [runtime],
  );

  const generateBattleReport = useCallback(
    async (battleRecord: string, targetLength: number) => {
      if (!runtime || reportRunningRef.current) return;
      reportRunningRef.current = true;
      setReport({
        status: "running",
        stage: "outline",
        report: "",
        proposal: "",
        error: "",
      });
      try {
        const result = await runtime.generateBattleReport(
          battleRecord,
          targetLength,
          (stage) => {
            if (mountedRef.current) {
              setReport((current) => ({ ...current, stage }));
            }
          },
        );
        if (!mountedRef.current) return;
        setReport({
          status: "completed",
          stage: null,
          report: result.finalReport,
          proposal: result.stateMemoryProposal,
          error: "",
        });
      } catch (error) {
        if (!mountedRef.current) return;
        setReport({
          status: "failed",
          stage: null,
          report: "",
          proposal: "",
          error: error instanceof Error ? error.message : "战报生成失败。",
        });
      } finally {
        reportRunningRef.current = false;
      }
    },
    [runtime],
  );

  return {
    runtimeState,
    report,
    resetReport,
    decideRealtime,
    generateBattleReport,
  };
}
