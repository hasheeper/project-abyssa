import { useEffect, useMemo, useRef, useState } from "react";
import { AbyssaLogo } from "../../shared/ui/branding/AbyssaLogo";
import {
  ABYSSA_LOGO_PART_LABELS,
  ABYSSA_LOGO_PARTS,
  DEFAULT_ABYSSA_LOGO_LAYOUT,
  cloneAbyssaLogoLayout,
  formatAbyssaLogoLayoutJson,
  formatAbyssaLogoLayoutTs,
  parseAbyssaLogoLayout
} from "../../shared/ui/branding/abyssaLogoLayout";
import type {
  AbyssaLogoLayout,
  AbyssaLogoPartId,
  AbyssaLogoPartTransform
} from "../../shared/ui/branding/abyssaLogoLayout";

const STORAGE_KEY = "abyssa.logo-studio.layout.v1";

type ExportMode = "json" | "ts";

const CONTROL_RANGES = {
  x: { min: -360, max: 360, step: 1 },
  y: { min: -260, max: 260, step: 1 },
  scale: { min: 0.2, max: 2.5, step: 0.01 },
  rotate: { min: -180, max: 180, step: 1 },
  opacity: { min: 0, max: 1, step: 0.01 }
} as const;

function loadInitialLayout(): AbyssaLogoLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return parseAbyssaLogoLayout(saved);
  } catch {
    // Storage may be unavailable in private contexts; the editor remains usable.
  }
  return cloneAbyssaLogoLayout();
}

function sameTransform(a: AbyssaLogoPartTransform, b: AbyssaLogoPartTransform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotate === b.rotate && a.opacity === b.opacity;
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="logo-studio-field">
      <span><b>{label}</b><small>{hint}</small></span>
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
        />
      </div>
    </label>
  );
}

export function App() {
  const [layout, setLayout] = useState<AbyssaLogoLayout>(loadInitialLayout);
  const [selectedPart, setSelectedPart] = useState<AbyssaLogoPartId>("titleTop");
  const [guides, setGuides] = useState(true);
  const [dimOthers, setDimOthers] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = layout[selectedPart];
  const dirtyCount = ABYSSA_LOGO_PARTS.filter((id) => !sameTransform(layout[id], DEFAULT_ABYSSA_LOGO_LAYOUT[id])).length;
  const exportText = useMemo(
    () => exportMode === "ts" ? formatAbyssaLogoLayoutTs(layout) : formatAbyssaLogoLayoutJson(layout),
    [exportMode, layout]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, formatAbyssaLogoLayoutJson(layout));
    } catch {
      // Editing should not depend on persistent storage.
    }
  }, [layout]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function updatePart(patch: Partial<AbyssaLogoPartTransform>) {
    setLayout((current) => ({
      ...current,
      [selectedPart]: { ...current[selectedPart], ...patch }
    }));
  }

  function resetPart() {
    setLayout((current) => ({
      ...current,
      [selectedPart]: { ...DEFAULT_ABYSSA_LOGO_LAYOUT[selectedPart] }
    }));
  }

  function importText(text: string) {
    try {
      setLayout(parseAbyssaLogoLayout(text));
      setNotice("参数已导入");
    } catch {
      setNotice("导入失败：不是有效的 Logo JSON");
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    importText(await file.text());
  }

  function downloadJson() {
    const blob = new Blob([formatAbyssaLogoLayoutJson(layout)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "abyssa-logo-layout.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("JSON 已下载");
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice("无法访问剪贴板，请手动复制文本");
    }
  }

  return (
    <div className="logo-studio">
      <header className="logo-studio-bar">
        <div>
          <p>ABYSSA · LOGO COMPOSER</p>
          <h1>Logo 部件参数工作台</h1>
        </div>
        <nav aria-label="Logo 操作">
          <button type="button" data-active={guides || undefined} onClick={() => setGuides((value) => !value)}>辅助线</button>
          <button type="button" data-active={dimOthers || undefined} onClick={() => setDimOthers((value) => !value)}>聚焦部件</button>
          <button type="button" onClick={() => fileInput.current?.click()}>导入 JSON</button>
          <button type="button" onClick={() => setExportMode("json")}>查看导出</button>
          <button type="button" onClick={downloadJson}>下载 JSON</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </nav>
      </header>

      <div className="logo-studio-shell">
        <aside className="logo-studio-parts">
          <header>
            <span>部件</span>
            <small>{dirtyCount}/8 已改</small>
          </header>
          <div className="logo-studio-part-list">
            {ABYSSA_LOGO_PARTS.map((id, index) => {
              const dirty = !sameTransform(layout[id], DEFAULT_ABYSSA_LOGO_LAYOUT[id]);
              return (
                <button
                  key={id}
                  type="button"
                  data-active={selectedPart === id || undefined}
                  data-dirty={dirty || undefined}
                  onClick={() => setSelectedPart(id)}
                >
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span>{ABYSSA_LOGO_PART_LABELS[id]}<small>{id}</small></span>
                  {dirty && <b aria-label="已修改">•</b>}
                </button>
              );
            })}
          </div>
          <p>也可以直接点击画布中的部件进行选择。</p>
        </aside>

        <main className="logo-studio-canvas" data-dim-others={dimOthers || undefined}>
          <div className="logo-studio-artboard">
            <AbyssaLogo
              layout={layout}
              selectedPart={selectedPart}
              onPartSelect={setSelectedPart}
            />
            {guides && (
              <div className="logo-studio-guides" aria-hidden="true">
                <i data-axis="x" />
                <i data-axis="y" />
                <span>1024 × 760</span>
              </div>
            )}
          </div>
          <footer>
            <span>当前：{ABYSSA_LOGO_PART_LABELS[selectedPart]}</span>
            <code>x {selected.x} · y {selected.y} · s {selected.scale} · r {selected.rotate}°</code>
          </footer>
        </main>

        <aside className="logo-studio-inspector">
          <header>
            <div><small>SELECTED PART</small><h2>{ABYSSA_LOGO_PART_LABELS[selectedPart]}</h2></div>
            <code>{selectedPart}</code>
          </header>

          <section>
            <h3>位置</h3>
            <NumberField label="X" hint="右移为正 · viewBox px" value={selected.x} {...CONTROL_RANGES.x} onChange={(x) => updatePart({ x })} />
            <NumberField label="Y" hint="下移为正 · viewBox px" value={selected.y} {...CONTROL_RANGES.y} onChange={(y) => updatePart({ y })} />
            <div className="logo-studio-nudge" aria-label="微调位置">
              <button type="button" onClick={() => updatePart({ y: selected.y - 1 })}>↑</button>
              <button type="button" onClick={() => updatePart({ x: selected.x - 1 })}>←</button>
              <button type="button" onClick={() => updatePart({ y: selected.y + 1 })}>↓</button>
              <button type="button" onClick={() => updatePart({ x: selected.x + 1 })}>→</button>
            </div>
          </section>

          <section>
            <h3>变换与外观</h3>
            <NumberField label="SCALE" hint="围绕部件中心缩放" value={selected.scale} {...CONTROL_RANGES.scale} onChange={(scale) => updatePart({ scale })} />
            <NumberField label="ROTATE" hint="顺时针角度" value={selected.rotate} {...CONTROL_RANGES.rotate} onChange={(rotate) => updatePart({ rotate })} />
            <NumberField label="OPACITY" hint="0 隐藏 / 1 不透明" value={selected.opacity} {...CONTROL_RANGES.opacity} onChange={(opacity) => updatePart({ opacity })} />
          </section>

          <div className="logo-studio-reset">
            <button type="button" onClick={resetPart}>重置当前部件</button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("重置全部 Logo 部件参数？")) setLayout(cloneAbyssaLogoLayout());
              }}
            >全部重置</button>
          </div>
        </aside>
      </div>

      {exportMode && (
        <div className="logo-studio-modal" role="dialog" aria-modal="true" aria-label="导出 Logo 参数">
          <div>
            <header>
              <nav>
                <button type="button" data-active={exportMode === "json" || undefined} onClick={() => setExportMode("json")}>JSON 快照</button>
                <button type="button" data-active={exportMode === "ts" || undefined} onClick={() => setExportMode("ts")}>TypeScript</button>
              </nav>
              <button type="button" onClick={() => setExportMode(null)}>关闭</button>
            </header>
            <p>{exportMode === "json" ? "可由本工作台再次导入，也适合存档或版本管理。" : "可直接保存为布局常量后传给 <AbyssaLogo layout={LOGO_LAYOUT} />。"}</p>
            <textarea readOnly spellCheck={false} value={exportText} />
            <button type="button" className="logo-studio-copy" onClick={copyExport}>{copied ? "✓ 已复制" : "复制到剪贴板"}</button>
          </div>
        </div>
      )}

      {notice && <div className="logo-studio-notice" role="status">{notice}</div>}
    </div>
  );
}
