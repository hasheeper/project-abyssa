import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";
import type { MansionPsdManifest } from "../../shared/domain/mansion/regions";
import { clamp, roundCoordinate } from "./region-editor-model";
import type { ViewTransform } from "./region-editor-types";

const MIN_SCALE = 0.08;
const MAX_SCALE = 4;

export function useMansionViewport(manifest: MansionPsdManifest | null) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const fitInitializedRef = useRef(false);
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 0.2 });

  const fitToView = useCallback(() => {
    if (!manifest || !viewportRef.current) return;
    const { clientWidth, clientHeight } = viewportRef.current;
    const scale = Math.min(
      (clientWidth - 48) / manifest.width,
      (clientHeight - 48) / manifest.height
    );
    setView({
      scale,
      x: (clientWidth - manifest.width * scale) / 2,
      y: (clientHeight - manifest.height * scale) / 2
    });
  }, [manifest]);

  useEffect(() => {
    if (!manifest || !viewportRef.current) return;
    if (!fitInitializedRef.current) {
      fitInitializedRef.current = true;
      fitToView();
    }
    const observer = new ResizeObserver(() => fitToView());
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [fitToView, manifest]);

  const clientToNormalized = useCallback((clientX: number, clientY: number) => {
    if (!manifest || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: roundCoordinate((clientX - rect.left - view.x) / view.scale / manifest.width),
      y: roundCoordinate((clientY - rect.top - view.y) / view.scale / manifest.height)
    };
  }, [manifest, view]);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!manifest || !viewportRef.current) return;
    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const canvasX = (localX - view.x) / view.scale;
    const canvasY = (localY - view.y) / view.scale;
    const nextScale = clamp(view.scale * Math.exp(-event.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
    setView({
      scale: nextScale,
      x: localX - canvasX * nextScale,
      y: localY - canvasY * nextScale
    });
  }, [manifest, view]);

  return {
    viewportRef,
    view,
    setView,
    fitToView,
    clientToNormalized,
    handleWheel
  };
}
