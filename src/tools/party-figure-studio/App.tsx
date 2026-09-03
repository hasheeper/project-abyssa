import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  clonePartyFigureCalibrations,
  parsePartyFigureCalibrationJson,
  parsePartyFigureCalibrationTypeScript,
  stringifyPartyFigureCalibrationJson,
  stringifyPartyFigureCalibrationTypeScript
} from "../../content/characters/partyFigureCalibration";
import type {
  PartyFigureCalibration,
  PartyFigureCalibrationMap,
  PartyFigureId
} from "../../content/characters/partyFigureCalibration";
import { partyFigureCatalog } from "../../assets/map/party-figures/catalog";
import { PartyFigureInspector } from "./PartyFigureInspector";
import {
  PartyFigurePreview
} from "./PartyFigurePreview";
import type {
  PartyFigureBackground,
  PartyFigurePreviewMode
} from "./PartyFigurePreview";
import { PartyFigureRoster } from "./PartyFigureRoster";
import {
  PARTY_FIGURE_STORAGE_KEY,
  clonePartyFigureMap,
  getDirtyPartyFigureIds,
  makeInitialPartyFigureLineup,
  togglePartyFigure,
  updatePartyFigureCalibration
} from "./party-figure-model";

type ExportFormat = "json" | "typescript";

function parseCalibrationText(text: string): PartyFigureCalibrationMap {
  try {
    return parsePartyFigureCalibrationJson(text);
  } catch {
    return parsePartyFigureCalibrationTypeScript(text);
  }
}

function loadSavedCalibration(fallback: PartyFigureCalibrationMap) {
  try {
    const saved = localStorage.getItem(PARTY_FIGURE_STORAGE_KEY);
    return saved ? parsePartyFigureCalibrationJson(saved) : clonePartyFigureMap(fallback);
  } catch {
    return clonePartyFigureMap(fallback);
  }
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="party-figure-dialog-backdrop" role="presentation">
      <section
        className="party-figure-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="party-figure-dialog__close"
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function App() {
  const baseline = useMemo(() => clonePartyFigureCalibrations(), []);
  const [calibrations, setCalibrations] = useState<PartyFigureCalibrationMap>(() =>
    loadSavedCalibration(baseline)
  );
  const [activeId, setActiveId] = useState<PartyFigureId>(partyFigureCatalog[0].id);
  const [partyIds, setPartyIds] = useState<PartyFigureId[]>(makeInitialPartyFigureLineup);
  const [mode, setMode] = useState<PartyFigurePreviewMode>("single");
  const [background, setBackground] = useState<PartyFigureBackground>("dark");
  const [showBaseline, setShowBaseline] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("已载入共享校准基线");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        PARTY_FIGURE_STORAGE_KEY,
        stringifyPartyFigureCalibrationJson(calibrations)
      );
    } catch {
      setStatus("浏览器拒绝保存；本次调整仅保留在当前页面");
    }
  }, [calibrations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setImportOpen(false);
      setExportOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
  }, []);

  const dirtyIds = useMemo(
    () => getDirtyPartyFigureIds(calibrations, baseline),
    [baseline, calibrations]
  );
  const activeEntry = partyFigureCatalog.find((entry) => entry.id === activeId)!;
  const exportText = useMemo(
    () => exportFormat === "json"
      ? stringifyPartyFigureCalibrationJson(calibrations)
      : stringifyPartyFigureCalibrationTypeScript(calibrations),
    [calibrations, exportFormat]
  );

  const updateCurrent = (next: PartyFigureCalibration) => {
    setCalibrations((current) => updatePartyFigureCalibration(current, activeId, next));
    setStatus(`${activeEntry.name} 参数已更新`);
  };

  const resetCurrent = () => {
    setCalibrations((current) => ({
      ...current,
      [activeId]: { ...baseline[activeId] }
    }));
    setStatus(`${activeEntry.name} 已恢复共享基线`);
  };

  const resetAll = () => {
    if (dirtyIds.size > 0 && !window.confirm("重置十名角色的全部校准参数？")) return;
    setCalibrations(clonePartyFigureMap(baseline));
    setStatus("十名角色已全部恢复共享基线");
  };

  const applyImport = (text: string) => {
    try {
      const next = parseCalibrationText(text);
      setCalibrations(clonePartyFigureMap(next));
      setImportError("");
      setImportOpen(false);
      setStatus("已导入十名角色的校准参数");
    } catch {
      setImportError("无法解析。请粘贴工作台导出的完整 JSON 或 TypeScript 参数表。");
    }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      applyImport(await file.text());
    } catch {
      setStatus(`无法读取文件：${file.name}`);
    }
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setStatus("参数已复制到剪贴板");
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1600);
    } catch {
      setStatus("无法访问剪贴板；可在导出框中手动复制");
    }
  };

  const downloadExport = () => {
    const extension = exportFormat === "json" ? "json" : "ts";
    const mime = exportFormat === "json" ? "application/json" : "text/typescript";
    const url = URL.createObjectURL(new Blob([exportText], { type: `${mime};charset=utf-8` }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `party-figure-calibration.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus(`已下载 ${anchor.download}`);
  };

  return (
    <main className="party-figure-workbench">
      <header className="party-figure-topbar">
        <div className="party-figure-topbar__title">
          <p>ABYSSA · MAP ASSET TOOL</p>
          <h1>队伍立绘对齐工作台</h1>
        </div>

        <div className="party-figure-topbar__controls">
          <span className="party-figure-segmented" aria-label="预览模式">
            <button type="button" data-active={mode === "single" || undefined} onClick={() => setMode("single")}>单图</button>
            <button type="button" data-active={mode === "party" || undefined} onClick={() => setMode("party")}>五人编队</button>
          </span>
          <span className="party-figure-segmented" aria-label="预览背景">
            <button type="button" data-active={background === "dark" || undefined} onClick={() => setBackground("dark")}>深色</button>
            <button type="button" data-active={background === "parchment" || undefined} onClick={() => setBackground("parchment")}>羊皮纸</button>
            <button type="button" data-active={background === "grid" || undefined} onClick={() => setBackground("grid")}>网格</button>
          </span>
          <button
            className="party-figure-topbar__button"
            type="button"
            data-active={showBaseline || undefined}
            onClick={() => setShowBaseline((current) => !current)}
          >
            {showBaseline ? "隐藏基线" : "显示基线"}
          </button>
          <button className="party-figure-topbar__button" type="button" onClick={() => {
            setImportText("");
            setImportError("");
            setImportOpen(true);
          }}>粘贴导入</button>
          <button className="party-figure-topbar__button" type="button" onClick={() => fileInputRef.current?.click()}>文件导入</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ts,application/json,text/plain"
            hidden
            onChange={importFile}
          />
          <button className="party-figure-topbar__button party-figure-topbar__button--gold" type="button" onClick={() => setExportOpen(true)}>导出参数</button>
        </div>

        <span className="party-figure-topbar__status" role="status" title={status}>{status}</span>
      </header>

      <div className="party-figure-workbench__body">
        <PartyFigureRoster
          catalog={partyFigureCatalog}
          activeId={activeId}
          partyIds={partyIds}
          dirtyIds={dirtyIds}
          onSelect={setActiveId}
          onToggleParty={(id) => setPartyIds((current) => togglePartyFigure(current, id))}
        />

        <section className="party-figure-workspace">
          <header className="party-figure-workspace__head">
            <div>
              <b>{mode === "single" ? "512 SOURCE CANVAS" : "880 × 350 PARTY REFERENCE"}</b>
              <span>{mode === "single" ? activeEntry.name : `${partyIds.length} 名角色参与叠排`}</span>
            </div>
            <span>共享参数：scale / x / y / flipX</span>
          </header>
          <div className="party-figure-workspace__surface">
            <PartyFigurePreview
              mode={mode}
              background={background}
              showBaseline={showBaseline}
              activeId={activeId}
              partyIds={partyIds}
              catalog={partyFigureCatalog}
              calibrations={calibrations}
              onSelect={setActiveId}
            />
          </div>
        </section>

        <PartyFigureInspector
          entry={activeEntry}
          calibration={calibrations[activeId]}
          dirty={dirtyIds.has(activeId)}
          onChange={updateCurrent}
          onResetCurrent={resetCurrent}
          onResetAll={resetAll}
        />
      </div>

      {importOpen && (
        <Modal title="导入校准参数" onClose={() => setImportOpen(false)}>
          <div className="party-figure-dialog__body">
            <p>支持本工作台导出的完整 JSON 或 TypeScript。导入成功后会覆盖十名角色当前参数。</p>
            <textarea
              aria-label="待导入参数"
              value={importText}
              placeholder="在这里粘贴参数……"
              onChange={(event) => setImportText(event.target.value)}
            />
            {importError && <p role="alert">{importError}</p>}
          </div>
          <footer>
            <button type="button" onClick={() => setImportOpen(false)}>取消</button>
            <button type="button" data-primary onClick={() => applyImport(importText)}>应用导入</button>
          </footer>
        </Modal>
      )}

      {exportOpen && (
        <Modal title="导出校准参数" onClose={() => setExportOpen(false)}>
          <div className="party-figure-dialog__body">
            <div className="party-figure-dialog__tabs" aria-label="导出格式">
              <button type="button" data-active={exportFormat === "json" || undefined} onClick={() => setExportFormat("json")}>JSON</button>
              <button type="button" data-active={exportFormat === "typescript" || undefined} onClick={() => setExportFormat("typescript")}>TypeScript</button>
            </div>
            <textarea aria-label="导出参数" readOnly value={exportText} />
          </div>
          <footer>
            <button type="button" onClick={() => setExportOpen(false)}>关闭</button>
            <button type="button" onClick={downloadExport}>下载文件</button>
            <button type="button" data-primary onClick={copyExport}>{copied ? "已复制" : "复制到剪贴板"}</button>
          </footer>
        </Modal>
      )}
    </main>
  );
}
