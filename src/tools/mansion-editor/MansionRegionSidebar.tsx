import type {
  ChangeEvent,
  Dispatch,
  SetStateAction
} from "react";
import type {
  MansionPsdManifest,
  MansionRectangle,
  MansionRegion,
  MansionRegionFile,
  MansionRegionKind,
  NormalizedRectangle
} from "../../shared/domain/mansion/regions";
import { createRegionTypeScript } from "./region-editor-model";
import { REGION_COLORS } from "./region-editor-types";
import type { DraftRectangle, DraftRegion } from "./region-editor-types";

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface MansionRegionSidebarProps {
  manifest: MansionPsdManifest;
  status: string;
  enabledLayers: Set<string>;
  setEnabledLayers: Dispatch<SetStateAction<Set<string>>>;
  rectangles: MansionRectangle[];
  regions: MansionRegion[];
  rectangleDraft: DraftRectangle | null;
  setRectangleDraft: Dispatch<SetStateAction<DraftRectangle | null>>;
  selectedRectangle: MansionRectangle | null;
  selectedRectangleId: string | null;
  draft: DraftRegion | null;
  setDraft: Dispatch<SetStateAction<DraftRegion | null>>;
  selectedRegion: MansionRegion | null;
  selectedId: string | null;
  setRectangles: Dispatch<SetStateAction<MansionRectangle[]>>;
  setRegions: Dispatch<SetStateAction<MansionRegion[]>>;
  setSelectedRectangleId: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setRectanglePreview: Dispatch<SetStateAction<NormalizedRectangle | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  beginRectangle: () => void;
  beginRegion: () => void;
  renameRectangle: (oldId: string, candidate: string) => void;
  updateRectangle: (id: string, patch: Partial<MansionRectangle>) => void;
  renameRegion: (oldId: string, candidate: string) => void;
  updateRegion: (id: string, patch: Partial<MansionRegion>) => void;
  completeDraft: () => void;
  restoreDefaults: () => void;
  handleImport: (event: ChangeEvent<HTMLInputElement>) => void;
  exportFile: MansionRegionFile | null;
}

export function MansionRegionSidebar({
  manifest,
  status,
  enabledLayers,
  setEnabledLayers,
  rectangles,
  regions,
  rectangleDraft,
  setRectangleDraft,
  selectedRectangle,
  selectedRectangleId,
  draft,
  setDraft,
  selectedRegion,
  selectedId,
  setRectangles,
  setRegions,
  setSelectedRectangleId,
  setSelectedId,
  setRectanglePreview,
  setStatus,
  beginRectangle,
  beginRegion,
  renameRectangle,
  updateRectangle,
  renameRegion,
  updateRegion,
  completeDraft,
  restoreDefaults,
  handleImport,
  exportFile
}: MansionRegionSidebarProps) {
  return (
        <aside className="mansion-editor__sidebar">
          <section>
            <div className="mansion-editor__section-title">
              <h2>矩形区域</h2>
              <button type="button" className="is-primary" onClick={beginRectangle}>
                + 新建矩形
              </button>
            </div>

            {(rectangleDraft || selectedRectangle) && (
              <div className="mansion-editor__fields">
                <label>
                  参数 ID
                  <input
                    value={(rectangleDraft ?? selectedRectangle)!.id}
                    onChange={(event) => rectangleDraft
                      ? setRectangleDraft({ ...rectangleDraft, id: event.target.value })
                      : renameRectangle(selectedRectangle!.id, event.target.value)}
                  />
                </label>
                <label>
                  显示名称
                  <input
                    value={(rectangleDraft ?? selectedRectangle)!.label}
                    onChange={(event) => rectangleDraft
                      ? setRectangleDraft({ ...rectangleDraft, label: event.target.value })
                      : updateRectangle(selectedRectangle!.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  类型
                  <select
                    value={(rectangleDraft ?? selectedRectangle)!.kind}
                    onChange={(event) => {
                      const kind = event.target.value as MansionRegionKind;
                      rectangleDraft
                        ? setRectangleDraft({ ...rectangleDraft, kind })
                        : updateRectangle(selectedRectangle!.id, { kind });
                    }}
                  >
                    <option value="room">房间</option>
                    <option value="building">功能建筑</option>
                    <option value="trace">生活痕迹</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                {rectangleDraft ? (
                  <div className="mansion-editor__draft-note">
                    在画面上按住鼠标并拖出矩形；Esc 取消。
                  </div>
                ) : (
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      setRectangles((current) => current.filter((rectangle) => rectangle.id !== selectedRectangle!.id));
                      setSelectedRectangleId(null);
                      setStatus("矩形已删除");
                    }}
                  >删除当前矩形</button>
                )}
              </div>
            )}

            <div className="mansion-editor__region-list">
              {rectangles.length === 0 && <p>适合大多数房间：点击“新建矩形”，然后在画面上拖拽。</p>}
              {rectangles.map((rectangle) => (
                <button
                  type="button"
                  key={rectangle.id}
                  className={rectangle.id === selectedRectangleId ? "is-selected" : ""}
                  onClick={() => {
                    setSelectedRectangleId(rectangle.id);
                    setSelectedId(null);
                    setDraft(null);
                    setRectangleDraft(null);
                    setRectanglePreview(null);
                  }}
                >
                  <i style={{ background: REGION_COLORS[rectangle.kind] }} />
                  <span>{rectangle.label}<small>{rectangle.id} · 矩形</small></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mansion-editor__section-title">
              <h2>多边形区域</h2>
              <button type="button" className="is-primary" onClick={beginRegion}>
                + 新建多边形
              </button>
            </div>

            {(draft || selectedRegion) && (
              <div className="mansion-editor__fields">
                <label>
                  参数 ID
                  <input
                    value={(draft ?? selectedRegion)!.id}
                    onChange={(event) => draft
                      ? setDraft({ ...draft, id: event.target.value })
                      : renameRegion(selectedRegion!.id, event.target.value)}
                  />
                </label>
                <label>
                  显示名称
                  <input
                    value={(draft ?? selectedRegion)!.label}
                    onChange={(event) => draft
                      ? setDraft({ ...draft, label: event.target.value })
                      : updateRegion(selectedRegion!.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  类型
                  <select
                    value={(draft ?? selectedRegion)!.kind}
                    onChange={(event) => {
                      const kind = event.target.value as MansionRegionKind;
                      draft
                        ? setDraft({ ...draft, kind })
                        : updateRegion(selectedRegion!.id, { kind });
                    }}
                  >
                    <option value="room">房间</option>
                    <option value="building">功能建筑</option>
                    <option value="trace">生活痕迹</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                {draft ? (
                  <div className="mansion-editor__inline-actions">
                    <button type="button" onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}>
                      撤回一点
                    </button>
                    <button type="button" disabled={draft.points.length < 3} onClick={completeDraft}>
                      闭合并保存
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      setRegions((current) => current.filter((region) => region.id !== selectedRegion!.id));
                      setSelectedId(null);
                      setStatus("区域已删除");
                    }}
                  >删除当前区域</button>
                )}
              </div>
            )}

            <div className="mansion-editor__region-list">
              {regions.length === 0 && <p>还没有区域。点击“新建多边形”后在画面上逐点框选。</p>}
              {regions.map((region) => (
                <button
                  type="button"
                  key={region.id}
                  className={region.id === selectedId ? "is-selected" : ""}
                  onClick={() => {
                    setSelectedId(region.id);
                    setSelectedRectangleId(null);
                    setDraft(null);
                    setRectangleDraft(null);
                    setRectanglePreview(null);
                  }}
                >
                  <i style={{ background: REGION_COLORS[region.kind] }} />
                  <span>{region.label}<small>{region.id} · {region.points.length} 点</small></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mansion-editor__section-title">
              <h2>PSD 图层</h2>
              <span>{enabledLayers.size}/{manifest.layers.length}</span>
            </div>
            <div className="mansion-editor__layer-list">
              {manifest.layers.map((layer) => (
                <label key={layer.id}>
                  <input
                    type="checkbox"
                    checked={enabledLayers.has(layer.id)}
                    onChange={() => setEnabledLayers((current) => {
                      const next = new Set(current);
                      next.has(layer.id) ? next.delete(layer.id) : next.add(layer.id);
                      return next;
                    })}
                  />
                  <span>{layer.id}<small>{layer.name}</small></span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mansion-editor__section-title"><h2>导入 / 导出</h2></div>
            <div className="mansion-editor__export-grid">
              <button type="button" onClick={restoreDefaults}>恢复 v8 默认</button>
              <label className="mansion-editor__file-button">
                导入 JSON
                <input type="file" accept="application/json,.json" onChange={handleImport} />
              </label>
              <button
                type="button"
                disabled={!exportFile}
                onClick={() => exportFile && navigator.clipboard.writeText(JSON.stringify(exportFile, null, 2)).then(() => setStatus("JSON 已复制"))}
              >复制 JSON</button>
              <button
                type="button"
                disabled={!exportFile}
                onClick={() => exportFile && downloadText("mansion-regions.json", JSON.stringify(exportFile, null, 2), "application/json")}
              >下载 JSON</button>
              <button
                type="button"
                disabled={!exportFile}
                onClick={() => exportFile && downloadText("mansion-regions.ts", createRegionTypeScript(exportFile), "text/typescript")}
              >下载 TS 参数</button>
            </div>
          </section>

          <footer>{status} · 已自动保存</footer>
        </aside>
  );
}
