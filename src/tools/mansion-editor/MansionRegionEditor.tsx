import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import type {
  MansionPsdManifest,
  MansionRectangle,
  MansionRegion,
  MansionRegionFile,
  NormalizedRectangle
} from "../../shared/domain/mansion/regions";
import { cloneDefaultMansionRegions } from "../../content/mansion/defaultRegions";
import {
  cleanRegionId,
  makeRegionFile,
  rectangleFromPoints
} from "./region-editor-model";
import { MansionRegionCanvas } from "./MansionRegionCanvas";
import { MansionRegionSidebar } from "./MansionRegionSidebar";
import { useMansionViewport } from "./useMansionViewport";
import type {
  DraftRectangle,
  DraftRegion,
  PanSession,
  RectangleDrawSession
} from "./region-editor-types";

const STORAGE_KEY = "abyssa:mansion-map-regions:v2:floor-aligned-v1";

function readSavedFile(): Pick<MansionRegionFile, "regions" | "rectangles"> {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return cloneDefaultMansionRegions();
    const parsed = JSON.parse(value) as MansionRegionFile;
    return {
      regions: Array.isArray(parsed.regions) ? parsed.regions : [],
      rectangles: Array.isArray(parsed.rectangles) ? parsed.rectangles : []
    };
  } catch {
    return cloneDefaultMansionRegions();
  }
}


function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
}

export function MansionRegionEditor() {
  const panRef = useRef<PanSession | null>(null);
  const rectangleDrawRef = useRef<RectangleDrawSession | null>(null);
  const spacePressedRef = useRef(false);
  const [savedFile] = useState(readSavedFile);
  const [manifest, setManifest] = useState<MansionPsdManifest | null>(null);
  const { viewportRef, view, setView, fitToView, clientToNormalized, handleWheel } =
    useMansionViewport(manifest);
  const [manifestError, setManifestError] = useState("");
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());
  const [regions, setRegions] = useState<MansionRegion[]>(savedFile.regions);
  const [rectangles, setRectangles] = useState<MansionRectangle[]>(savedFile.rectangles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRectangleId, setSelectedRectangleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRegion | null>(null);
  const [rectangleDraft, setRectangleDraft] = useState<DraftRectangle | null>(null);
  const [rectanglePreview, setRectanglePreview] = useState<NormalizedRectangle | null>(null);
  const [status, setStatus] = useState("等待框选");

  useEffect(() => {
    const manifestUrl = `${import.meta.env.BASE_URL}mansion-map/manifest.json`;
    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.json() as Promise<MansionPsdManifest>;
      })
      .then((value) => {
        setManifest(value);
        setEnabledLayers(new Set(value.layers.filter((layer) => layer.visible).map((layer) => layer.id)));
      })
      .catch(() => setManifestError("无法读取 PSD 图层清单，请先运行解包脚本。"));
  }, []);

  useEffect(() => {
    if (!manifest) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(makeRegionFile(manifest, regions, rectangles))
    );
  }, [manifest, rectangles, regions]);

  const uniqueRegionId = useCallback((candidate: string) => {
    const allIds = [...regions.map((region) => region.id), ...rectangles.map((rectangle) => rectangle.id)];
    const base = cleanRegionId(candidate) || `region-${allIds.length + 1}`;
    if (!allIds.includes(base)) return base;
    let suffix = 2;
    while (allIds.includes(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }, [rectangles, regions]);

  const beginRegion = () => {
    const index = regions.length + rectangles.length + 1;
    setSelectedId(null);
    setSelectedRectangleId(null);
    setRectangleDraft(null);
    setRectanglePreview(null);
    setDraft({
      id: uniqueRegionId(`region-${index}`),
      label: `未命名区域 ${index}`,
      kind: "room",
      points: []
    });
    setStatus("框选中：逐点点击，按 Enter 或点击首点闭合");
  };

  const beginRectangle = () => {
    const index = regions.length + rectangles.length + 1;
    setSelectedId(null);
    setSelectedRectangleId(null);
    setDraft(null);
    setRectanglePreview(null);
    setRectangleDraft({
      id: uniqueRegionId(`rectangle-${index}`),
      label: `未命名矩形 ${index}`,
      kind: "room"
    });
    setStatus("矩形框选中：在画面上按住并拖拽");
  };

  const completeDraft = useCallback(() => {
    if (!draft || draft.points.length < 3) {
      setStatus("至少需要 3 个顶点");
      return;
    }
    const region: MansionRegion = {
      ...draft,
      id: uniqueRegionId(draft.id),
      points: draft.points.map((point) => ({ ...point }))
    };
    setRegions((current) => [...current, region]);
    setSelectedId(region.id);
    setDraft(null);
    setStatus(`已保存：${region.label}`);
  }, [draft, uniqueRegionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
      if ((!draft && !rectangleDraft) || isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        setDraft(null);
        setRectangleDraft(null);
        setRectanglePreview(null);
        rectangleDrawRef.current = null;
        setStatus("已取消本次框选");
        return;
      }
      if (!draft) return;
      if (event.key === "Enter") {
        event.preventDefault();
        completeDraft();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setDraft((current) => current ? { ...current, points: current.points.slice(0, -1) } : null);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [completeDraft, draft, rectangleDraft]);

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wantsPan = event.button === 1 || spacePressedRef.current;
    if (wantsPan) {
      event.preventDefault();
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: view.x,
        startY: view.y
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const point = clientToNormalized(event.clientX, event.clientY);
    if (!point) return;
    if (rectangleDraft) {
      rectangleDrawRef.current = { pointerId: event.pointerId, start: point };
      setRectanglePreview({ x: point.x, y: point.y, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (!draft) return;
    setDraft((current) => current ? { ...current, points: [...current.points, point] } : null);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      setView((current) => ({
        ...current,
        x: pan.startX + event.clientX - pan.startClientX,
        y: pan.startY + event.clientY - pan.startClientY
      }));
      return;
    }
    const rectangleDraw = rectangleDrawRef.current;
    if (rectangleDraw?.pointerId === event.pointerId) {
      const point = clientToNormalized(event.clientX, event.clientY);
      if (point) setRectanglePreview(rectangleFromPoints(rectangleDraw.start, point));
    }
  };

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    const rectangleDraw = rectangleDrawRef.current;
    if (rectangleDraw?.pointerId !== event.pointerId) return;
    rectangleDrawRef.current = null;
    const end = clientToNormalized(event.clientX, event.clientY);
    if (!end || !rectangleDraft) return;
    const rect = rectangleFromPoints(rectangleDraw.start, end);
    if (rect.width < 0.001 || rect.height < 0.001) {
      setRectanglePreview(null);
      setStatus("矩形太小，请重新拖拽");
      return;
    }
    const rectangle: MansionRectangle = {
      ...rectangleDraft,
      id: uniqueRegionId(rectangleDraft.id),
      rect
    };
    setRectangles((current) => [...current, rectangle]);
    setSelectedRectangleId(rectangle.id);
    setRectangleDraft(null);
    setRectanglePreview(null);
    setStatus(`已保存矩形：${rectangle.label}`);
  };

  const updateRegion = (id: string, patch: Partial<MansionRegion>) => {
    setRegions((current) => current.map((region) => region.id === id ? { ...region, ...patch } : region));
  };

  const renameRegion = (oldId: string, candidate: string) => {
    const nextId = cleanRegionId(candidate);
    if (!nextId || nextId === oldId) return;
    if ([...regions, ...rectangles].some((region) => region.id === nextId && region.id !== oldId)) {
      setStatus(`参数 ID “${nextId}” 已存在`);
      return;
    }
    setRegions((current) => current.map((region) =>
      region.id === oldId ? { ...region, id: nextId } : region
    ));
    setSelectedId(nextId);
  };

  const updateRectangle = (id: string, patch: Partial<MansionRectangle>) => {
    setRectangles((current) => current.map((rectangle) =>
      rectangle.id === id ? { ...rectangle, ...patch } : rectangle
    ));
  };

  const renameRectangle = (oldId: string, candidate: string) => {
    const nextId = cleanRegionId(candidate);
    if (!nextId || nextId === oldId) return;
    if ([...regions, ...rectangles].some((region) => region.id === nextId && region.id !== oldId)) {
      setStatus(`参数 ID “${nextId}” 已存在`);
      return;
    }
    setRectangles((current) => current.map((rectangle) =>
      rectangle.id === oldId ? { ...rectangle, id: nextId } : rectangle
    ));
    setSelectedRectangleId(nextId);
  };

  const moveVertex = (
    event: ReactPointerEvent<SVGCircleElement>,
    regionId: string,
    pointIndex: number
  ) => {
    const point = clientToNormalized(event.clientX, event.clientY);
    if (!point) return;
    setRegions((current) => current.map((region) => {
      if (region.id !== regionId) return region;
      const points = region.points.map((item, index) => index === pointIndex ? point : item);
      return { ...region, points };
    }));
  };

  const moveRectangleCorner = (
    event: ReactPointerEvent<SVGCircleElement>,
    rectangleId: string,
    corner: "tl" | "tr" | "br" | "bl"
  ) => {
    const point = clientToNormalized(event.clientX, event.clientY);
    if (!point) return;
    setRectangles((current) => current.map((rectangle) => {
      if (rectangle.id !== rectangleId) return rectangle;
      const { x, y, width, height } = rectangle.rect;
      const opposite = {
        tl: { x: x + width, y: y + height },
        tr: { x, y: y + height },
        br: { x, y },
        bl: { x: x + width, y }
      }[corner];
      return { ...rectangle, rect: rectangleFromPoints(opposite, point) };
    }));
  };

  const exportFile = useMemo(
    () => manifest ? makeRegionFile(manifest, regions, rectangles) : null,
    [manifest, rectangles, regions]
  );
  const selectedRegion = regions.find((region) => region.id === selectedId) ?? null;
  const selectedRectangle = rectangles.find((rectangle) => rectangle.id === selectedRectangleId) ?? null;

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !manifest) return;
    try {
      const parsed = JSON.parse(await file.text()) as MansionRegionFile;
      if (parsed.version !== 2 || !Array.isArray(parsed.regions) || !Array.isArray(parsed.rectangles)) throw new Error();
      if (parsed.canvas.width !== manifest.width || parsed.canvas.height !== manifest.height) {
        throw new Error("画布尺寸不一致");
      }
      setRegions(parsed.regions);
      setRectangles(parsed.rectangles);
      setSelectedId(null);
      setSelectedRectangleId(null);
      setDraft(null);
      setRectangleDraft(null);
      setRectanglePreview(null);
      setStatus(`已导入 ${parsed.rectangles.length} 个矩形、${parsed.regions.length} 个多边形`);
    } catch (error) {
      setStatus(error instanceof Error && error.message ? error.message : "导入文件格式无效");
    }
  };

  const restoreDefaults = () => {
    if (!window.confirm("恢复 v8 原稿默认标注？当前浏览器中的微调会被替换。")) return;
    const defaults = cloneDefaultMansionRegions();
    setRectangles(defaults.rectangles);
    setRegions(defaults.regions);
    setSelectedId(null);
    setSelectedRectangleId(null);
    setDraft(null);
    setRectangleDraft(null);
    setRectanglePreview(null);
    setStatus(`已恢复 ${defaults.rectangles.length} 个矩形、${defaults.regions.length} 个多边形`);
  };

  if (manifestError) {
    return <main className="mansion-editor mansion-editor--error">{manifestError}</main>;
  }
  if (!manifest) {
    return <main className="mansion-editor mansion-editor--loading">正在读取 PSD 图层…</main>;
  }


  return (
    <main className="mansion-editor">
      <header className="mansion-editor__topbar">
        <div>
          <strong>洋馆热区标注器</strong>
          <span>{manifest.source} · {manifest.width} × {manifest.height}</span>
        </div>
        <div className="mansion-editor__view-actions">
          <button type="button" onClick={fitToView}>适配窗口</button>
          <button
            type="button"
            onClick={() => setView({ x: 24, y: 24, scale: 1 })}
          >100%</button>
          <output>{Math.round(view.scale * 100)}%</output>
        </div>
      </header>
      <section className="mansion-editor__workspace">
        <MansionRegionCanvas
          viewportRef={viewportRef}
          manifest={manifest}
          enabledLayers={enabledLayers}
          rectangles={rectangles}
          regions={regions}
          selectedRectangleId={selectedRectangleId}
          selectedId={selectedId}
          rectangleDraft={rectangleDraft}
          rectanglePreview={rectanglePreview}
          draft={draft}
          view={view}
          handleViewportPointerDown={handleViewportPointerDown}
          handleViewportPointerMove={handleViewportPointerMove}
          finishPan={finishPan}
          handleWheel={handleWheel}
          setSelectedRectangleId={setSelectedRectangleId}
          setSelectedId={setSelectedId}
          moveRectangleCorner={moveRectangleCorner}
          moveVertex={moveVertex}
          completeDraft={completeDraft}
        />

        <MansionRegionSidebar
          manifest={manifest}
          status={status}
          enabledLayers={enabledLayers}
          setEnabledLayers={setEnabledLayers}
          rectangles={rectangles}
          regions={regions}
          rectangleDraft={rectangleDraft}
          setRectangleDraft={setRectangleDraft}
          selectedRectangle={selectedRectangle}
          selectedRectangleId={selectedRectangleId}
          draft={draft}
          setDraft={setDraft}
          selectedRegion={selectedRegion}
          selectedId={selectedId}
          setRectangles={setRectangles}
          setRegions={setRegions}
          setSelectedRectangleId={setSelectedRectangleId}
          setSelectedId={setSelectedId}
          setRectanglePreview={setRectanglePreview}
          setStatus={setStatus}
          beginRectangle={beginRectangle}
          beginRegion={beginRegion}
          renameRectangle={renameRectangle}
          updateRectangle={updateRectangle}
          renameRegion={renameRegion}
          updateRegion={updateRegion}
          completeDraft={completeDraft}
          restoreDefaults={restoreDefaults}
          handleImport={handleImport}
          exportFile={exportFile}
        />
      </section>
    </main>
  );
}
