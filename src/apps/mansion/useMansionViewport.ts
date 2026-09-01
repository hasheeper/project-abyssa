import { useCallback, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent
} from "react";
import { STAGE_CANVAS_WIDTH } from "../../shared/stage";
import { INITIAL_PAN, clampPan } from "./mansion-geometry";

const DRAG_THRESHOLD = 7;

type DragState = {
  pointerId: number;
  startClientX: number;
  startPan: number;
  moved: boolean;
};

export type UseMansionViewportOptions = {
  roomFocused: boolean;
};

/** Owns horizontal world navigation and click suppression after a drag. */
export function useMansionViewport({ roomFocused }: UseMansionViewportOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [panX, setPanX] = useState(INITIAL_PAN);
  const [dragging, setDragging] = useState(false);

  const shiftPan = useCallback((delta: number) => {
    setPanX((value) => clampPan(value + delta));
  }, []);

  const stagePerClientPixel = () => {
    const viewportWidth =
      viewportRef.current?.getBoundingClientRect().width ?? STAGE_CANVAS_WIDTH;
    return STAGE_CANVAS_WIDTH / viewportWidth;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (roomFocused || event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest("[data-no-pan]") && !target.closest(".mansion-region")) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startPan: panX,
      moved: false
    };
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = (event.clientX - drag.startClientX) * stagePerClientPixel();

    if (!drag.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    }
    setPanX(clampPan(drag.startPan + delta));
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (roomFocused) return;
    const input =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    shiftPan(-input * stagePerClientPixel() * 0.7);
  };

  const isClickSuppressed = useCallback(() => suppressClickRef.current, []);

  return {
    viewportRef,
    panX,
    dragging,
    shiftPan,
    isClickSuppressed,
    handlePointerDown,
    handlePointerMove,
    finishPointerDrag,
    handleWheel
  };
}
