import { useCallback, useEffect, useRef, useState } from "react";
import type { RpSeat, RpStageState } from "../rp-stage";

export interface DepartingRpActor {
  actorId: string;
  token: number;
}

export type DepartingRpActors = Record<RpSeat, DepartingRpActor | null>;

const EMPTY_SLOTS: RpStageState["slots"] = { left: null, right: null };
const SEATS: RpSeat[] = ["left", "right"];

/** 保留被替换的角色，直到对应离场动画结束。 */
export function useRpSeatLifecycle(slots: RpStageState["slots"]) {
  const [departing, setDeparting] = useState<DepartingRpActors>({ left: null, right: null });
  const previousSlotsRef = useRef<RpStageState["slots"]>(EMPTY_SLOTS);
  const tokenRef = useRef(0);

  useEffect(() => {
    const leaving: Partial<Record<RpSeat, DepartingRpActor>> = {};
    for (const seat of SEATS) {
      const previous = previousSlotsRef.current[seat];
      if (previous && previous !== slots[seat]) {
        tokenRef.current += 1;
        leaving[seat] = { actorId: previous, token: tokenRef.current };
      }
    }

    previousSlotsRef.current = { left: slots.left, right: slots.right };
    if (Object.keys(leaving).length > 0) {
      setDeparting((current) => ({ ...current, ...leaving }));
    }
  }, [slots]);

  const clearDeparting = useCallback((seat: RpSeat, token: number) => {
    setDeparting((current) =>
      current[seat]?.token === token ? { ...current, [seat]: null } : current
    );
  }, []);

  return { departing, clearDeparting };
}
