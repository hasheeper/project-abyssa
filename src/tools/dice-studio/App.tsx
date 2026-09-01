import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  DEFAULT_EXPEDITION_DIE_FACES,
  EXPEDITION_DIE_FACE_ORIENTATIONS,
  ExpeditionDieCube
} from "../../shared/ui/dice-face/ExpeditionDieCube";
import type {
  ExpeditionDieFaceConfig,
  ExpeditionDieFaceNumber,
  ExpeditionDieRotation
} from "../../shared/ui/dice-face/ExpeditionDieCube";
import {
  DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT
} from "../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import type {
  ExpeditionDieSeal,
  ExpeditionDieStampAction,
  ExpeditionDieStampLayout,
  ExpeditionDieSuitShape
} from "../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import { randomRollDuration } from "../../shared/presentation/roll/timing";

const STORAGE_KEY = "abyssa.dice-studio.cube.v4";
const FACE_NUMBERS: ExpeditionDieFaceNumber[] = [1, 2, 3, 4, 5, 6];
const SUIT_SHAPES: Array<{ id: ExpeditionDieSuitShape; label: string }> = [
  { id: "diamond", label: "菱形" },
  { id: "triangle", label: "三角形" },
  { id: "square", label: "方形" },
  { id: "circle", label: "圆形" }
];
const SEALS: Array<{ id: ExpeditionDieSeal; label: string; note: string }> = [
  { id: "none", label: "无铭", note: "空圆" },
  { id: "rust", label: "锈铭", note: "裂环" },
  { id: "plain", label: "素铭", note: "实点" },
  { id: "gild", label: "金铭", note: "四芒" }
];

const ACTIONS: Array<{ id: ExpeditionDieStampAction; label: string; note: string }> = [
  { id: "attack", label: "攻击", note: "BROADSWORD" },
  { id: "guard", label: "格挡", note: "CROSS SHIELD" },
  { id: "heal", label: "治疗", note: "HOSPITAL CROSS" },
  { id: "coin", label: "调包", note: "SWAP BAG" },
  { id: "art", label: "术式", note: "MAGIC PALM" },
  { id: "wild", label: "命数", note: "WILD" },
  { id: "blank", label: "空面", note: "BLOCKED" }
];

type SavedState = {
  version: 4;
  faces: ExpeditionDieFaceConfig[];
  layout: ExpeditionDieStampLayout;
  suitShape: ExpeditionDieSuitShape;
  recessDepth: number;
};

type DragState = {
  active: boolean;
  x: number;
  y: number;
};

function cloneDefaultLayout(): ExpeditionDieStampLayout {
  return { ...DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT };
}

function cloneDefaultFaces(): ExpeditionDieFaceConfig[] {
  return DEFAULT_EXPEDITION_DIE_FACES.map((face) => ({ ...face }));
}

function isStampAction(value: unknown): value is ExpeditionDieStampAction {
  return ACTIONS.some(({ id }) => id === value);
}

function isSeal(value: unknown): value is ExpeditionDieSeal {
  return SEALS.some(({ id }) => id === value);
}

function loadSavedState(): SavedState {
  const fallback: SavedState = {
    version: 4,
    faces: cloneDefaultFaces(),
    layout: cloneDefaultLayout(),
    suitShape: "diamond",
    recessDepth: 6
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    if (parsed.version !== 4 || !Array.isArray(parsed.faces) || !parsed.layout) return fallback;

    const faces = FACE_NUMBERS.map((number) => {
      const savedFace = parsed.faces?.find((face) => face.number === number);
      const defaultFace = fallback.faces[number - 1];
      if (!savedFace || !isStampAction(savedFace.action)) return defaultFace;
      return {
        number,
        fate: Number.isInteger(savedFace.fate) && savedFace.fate >= 1
          ? Math.min(6, savedFace.fate)
          : defaultFace.fate,
        power: Number.isInteger(savedFace.power) && savedFace.power >= 0
          ? Math.min(6, savedFace.power)
          : defaultFace.power,
        seal: isSeal(savedFace.seal) ? savedFace.seal : defaultFace.seal,
        action: savedFace.action,
        textureRotation: Number.isFinite(savedFace.textureRotation)
          ? savedFace.textureRotation
          : defaultFace.textureRotation
      };
    });
    const layout = { ...fallback.layout, ...parsed.layout };
    if (Object.values(layout).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return fallback;
    }
    const recessDepth = Number.isFinite(parsed.recessDepth)
      ? Math.max(0, Math.min(14, parsed.recessDepth!))
      : fallback.recessDepth;

    const suitShape = SUIT_SHAPES.some(({ id }) => id === parsed.suitShape)
      ? parsed.suitShape!
      : fallback.suitShape;

    return { version: 4, faces, layout, suitShape, recessDepth };
  } catch {
    return fallback;
  }
}

function nearestAngle(current: number, target: number) {
  return target + Math.round((current - target) / 360) * 360;
}

function nextRollRotation(
  current: ExpeditionDieRotation,
  face: ExpeditionDieFaceNumber,
  random: () => number = Math.random
): ExpeditionDieRotation {
  const target = EXPEDITION_DIE_FACE_ORIENTATIONS[face];
  const normalize = (value: number) => ((value % 360) + 360) % 360;
  return {
    x: current.x
      + (2 + Math.floor(random() * 2)) * 360
      + ((normalize(target.x) - normalize(current.x) + 360) % 360),
    y: current.y
      + (2 + Math.floor(random() * 2)) * 360
      + ((normalize(target.y) - normalize(current.y) + 360) % 360)
  };
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
    <label className="dice-studio-field">
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
  const [initial] = useState(loadSavedState);
  const [faces, setFaces] = useState<ExpeditionDieFaceConfig[]>(initial.faces);
  const [layout, setLayout] = useState<ExpeditionDieStampLayout>(initial.layout);
  const [suitShape, setSuitShape] = useState<ExpeditionDieSuitShape>(initial.suitShape);
  const [recessDepth, setRecessDepth] = useState(initial.recessDepth);
  const [currentFace, setCurrentFace] = useState<ExpeditionDieFaceNumber>(1);
  const [rotation, setRotation] = useState<ExpeditionDieRotation>({ x: -18, y: 28 });
  const [rolling, setRolling] = useState(false);
  const [rollDuration, setRollDuration] = useState(0.9);
  const [dragging, setDragging] = useState(false);
  const [freeView, setFreeView] = useState(true);
  const [showFrame, setShowFrame] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const [showTexture, setShowTexture] = useState(true);
  const [showCorners, setShowCorners] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [notice, setNotice] = useState("");
  const drag = useRef<DragState>({ active: false, x: 0, y: 0 });
  const rollTimer = useRef<number | null>(null);

  const selectedFace = faces.find(({ number }) => number === currentFace)!;
  const selectedAction = ACTIONS.find(({ id }) => id === selectedFace.action)!;
  const exportText = useMemo(
    () => JSON.stringify({
      version: 4,
      cube: { size: 300, recessDepth, suitShape },
      faces,
      layout
    }, null, 2),
    [faces, layout, recessDepth, suitShape]
  );

  useEffect(() => {
    try {
      const persisted: SavedState = { version: 4, faces, layout, suitShape, recessDepth };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // 禁用本地存储时，调试台仍保持完整功能。
    }
  }, [faces, layout, recessDepth, suitShape]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 1600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => () => {
    if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
  }, []);

  useEffect(() => {
    setFaces((current) => current.map((face) => (
      face.fate >= 1 && face.fate <= 6
        ? face
        : { ...face, fate: Math.max(1, Math.min(6, face.fate)) }
    )));
  }, []);

  function updateLayout(patch: Partial<ExpeditionDieStampLayout>) {
    setLayout((current) => ({ ...current, ...patch }));
  }

  function updateCurrentFace(patch: Partial<Omit<ExpeditionDieFaceConfig, "number">>) {
    setFaces((current) => current.map((face) => (
      face.number === currentFace ? { ...face, ...patch } : face
    )));
  }

  function turnToFace(number: ExpeditionDieFaceNumber, loops = 0) {
    if (rolling) return;
    const target = EXPEDITION_DIE_FACE_ORIENTATIONS[number];
    setAutoRotate(false);
    setFreeView(false);
    setCurrentFace(number);
    setRotation((current) => ({
      x: nearestAngle(current.x, target.x),
      y: nearestAngle(current.y, target.y) + loops * 360
    }));
  }

  function roll() {
    if (rolling) return;
    let result = currentFace;
    while (result === currentFace) {
      result = FACE_NUMBERS[Math.floor(Math.random() * FACE_NUMBERS.length)];
    }
    const duration = randomRollDuration();
    setAutoRotate(false);
    setFreeView(false);
    setCurrentFace(result);
    setRollDuration(duration);
    setRolling(true);
    setRotation((current) => nextRollRotation(current, result));

    if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
    rollTimer.current = window.setTimeout(() => {
      setRolling(false);
      rollTimer.current = null;
    }, duration * 1000 + 80);
  }

  function reset() {
    if (rollTimer.current !== null) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    setFaces(cloneDefaultFaces());
    setLayout(cloneDefaultLayout());
    setSuitShape("diamond");
    setRecessDepth(6);
    setCurrentFace(1);
    setRotation({ x: -18, y: 28 });
    setRolling(false);
    setRollDuration(0.9);
    setFreeView(true);
    setShowFrame(true);
    setShowPanel(true);
    setShowTexture(true);
    setShowCorners(true);
    setShowGuides(false);
    setAutoRotate(false);
    setPreviewScale(1);
    setNotice("已恢复双层六面骰默认值");
  }

  async function copyParameters() {
    try {
      await navigator.clipboard.writeText(exportText);
      setNotice("六面参数 JSON 已复制");
    } catch {
      setNotice("剪贴板不可用");
    }
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (rolling) return;
    drag.current = { active: true, x: event.clientX, y: event.clientY };
    setAutoRotate(false);
    setFreeView(true);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    setRotation((current) => ({
      x: Math.max(-88, Math.min(88, current.x - deltaY * 0.5)),
      y: current.y + deltaX * 0.5
    }));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const previewStyle = {
    "--dice-studio-preview-scale": previewScale
  } as CSSProperties;

  return (
    <div className="dice-studio">
      <header className="dice-studio-bar">
        <div>
          <p>ABYSSAL EXPEDITION · DOUBLE-LAYER DIE LAB</p>
          <h1>战斗六面骰调试台</h1>
        </div>
        <nav aria-label="图层与调试操作">
          <button type="button" data-active={showFrame || undefined} onClick={() => setShowFrame((value) => !value)}>外框层</button>
          <button type="button" data-active={showPanel || undefined} onClick={() => setShowPanel((value) => !value)}>木面层</button>
          <button type="button" data-active={showTexture || undefined} onClick={() => setShowTexture((value) => !value)}>做旧纹理</button>
          <button type="button" data-active={showCorners || undefined} onClick={() => setShowCorners((value) => !value)}>四角信息</button>
          <button type="button" data-active={showGuides || undefined} onClick={() => setShowGuides((value) => !value)}>辅助线</button>
          <button type="button" data-active={autoRotate || undefined} disabled={rolling} onClick={() => setAutoRotate((value) => !value)}>自动旋转</button>
          <button type="button" onClick={copyParameters}>复制参数</button>
          <button type="button" onClick={reset}>恢复默认</button>
        </nav>
      </header>

      <div className="dice-studio-shell">
        <aside className="dice-studio-actions">
          <header><span>第 {currentFace} 面图章</span><small>FACE ACTION</small></header>
          <div>
            {ACTIONS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-active={selectedFace.action === item.id || undefined}
                onClick={() => updateCurrentFace({ action: item.id })}
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>{item.label}<small>{item.note}</small></span>
              </button>
            ))}
          </div>
          <p>当前只修改朝向正面的骰面。六面各自保存图章、命数与纹理方向，外框、下沉深度和图章布局为公共参数。</p>
        </aside>

        <main className="dice-studio-preview" style={previewStyle}>
          <div
            className="dice-studio-scene"
            data-dragging={dragging || undefined}
            data-rolling={rolling || undefined}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="dice-studio-scale">
              <div className="dice-studio-auto-spin" data-auto={autoRotate || undefined}>
                <div
                  className="dice-studio-tumble"
                  data-rolling={rolling || undefined}
                  style={{ "--dice-studio-roll-bounce-duration": `${rollDuration * 0.75}s` } as CSSProperties}
                >
                  <ExpeditionDieCube
                    faces={faces}
                    layout={layout}
                    rotation={rotation}
                    recessDepth={recessDepth}
                    suitShape={suitShape}
                    rollDuration={rollDuration}
                    dragging={dragging}
                    showFrame={showFrame}
                    showPanel={showPanel}
                    showTexture={showTexture}
                    showCorners={showCorners}
                    showGuides={showGuides}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="dice-studio-face-controls" aria-label="骰面控制">
            <span>转到面</span>
            {FACE_NUMBERS.map((number) => (
              <button
                key={number}
                type="button"
                data-active={!freeView && currentFace === number || undefined}
                disabled={rolling}
                onClick={() => turnToFace(number)}
              >
                {number}
              </button>
            ))}
            <button className="dice-studio-roll" type="button" disabled={rolling} onClick={roll}>{rolling ? "投掷中" : "掷骰"}</button>
          </div>

          <footer>
            <span>{rolling ? "投掷中" : freeView ? "自由观察" : `当前面 ${currentFace} · 对面 ${7 - currentFace}`} · {selectedAction.label}</span>
            <code>外框 Z 0 · 木面 Z −{recessDepth}px</code>
          </footer>
        </main>

        <aside className="dice-studio-inspector">
          <header>
            <div><small>CUBE INSPECTOR</small><h2>第 {currentFace} 面参数</h2></div>
            <code>6 × viewBox 280</code>
          </header>

          <section>
            <h3>六面与双层结构</h3>
            <NumberField label="RECESS" hint="木面向内下沉 px" value={recessDepth} min={0} max={14} step={0.5} onChange={setRecessDepth} />
            <NumberField label="左上 · 命数" hint={`第 ${currentFace} 面 · 1–6`} value={selectedFace.fate} min={1} max={6} step={1} onChange={(fate) => updateCurrentFace({ fate: Math.max(1, Math.min(6, fate)) })} />
            <div className="dice-studio-suit-picker">
              <span><b>花色底板</b><small>整颗骰子共用</small></span>
              <div>
                {SUIT_SHAPES.map((suit) => (
                  <button
                    key={suit.id}
                    type="button"
                    data-active={suitShape === suit.id || undefined}
                    onClick={() => setSuitShape(suit.id)}
                  >
                    <i data-shape={suit.id} />
                    {suit.label}
                  </button>
                ))}
              </div>
            </div>
            <NumberField label="右下 · 战面力量" hint="双刻面斜楔 · 0–6" value={selectedFace.power} min={0} max={6} step={1} onChange={(power) => updateCurrentFace({ power: Math.max(0, Math.min(6, power)) })} />
            <div className="dice-studio-seal-picker">
              <span><b>右上 · 四铭</b><small>当前第 {currentFace} 面</small></span>
              <div>
                {SEALS.map((seal) => (
                  <button
                    key={seal.id}
                    type="button"
                    data-seal={seal.id}
                    data-active={selectedFace.seal === seal.id || undefined}
                    onClick={() => updateCurrentFace({ seal: seal.id })}
                  >
                    <i />
                    <span>{seal.label}<small>{seal.note}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <NumberField label="纹理角度" hint="只旋转当前木纹" value={selectedFace.textureRotation} min={0} max={360} step={90} onChange={(textureRotation) => updateCurrentFace({ textureRotation })} />
            <dl className="dice-studio-slot-map">
              <div><dt>左上</dt><dd>花色底板 + 命数</dd></div>
              <div><dt>右上</dt><dd>无铭 / 锈铭 / 素铭 / 金铭</dd></div>
              <div><dt>右下</dt><dd>战面力量 · 双刻面斜楔</dd></div>
            </dl>
          </section>

          <section>
            <h3>公共图章布局</h3>
            <NumberField label="X" hint="右移为正 · viewBox px" value={layout.x} min={-70} max={70} step={1} onChange={(x) => updateLayout({ x })} />
            <NumberField label="Y" hint="下移为正 · viewBox px" value={layout.y} min={-70} max={70} step={1} onChange={(y) => updateLayout({ y })} />
            <NumberField label="SCALE" hint="图章缩放" value={layout.scale} min={0.45} max={1.55} step={0.01} onChange={(scale) => updateLayout({ scale })} />
            <NumberField label="ROTATE" hint="顺时针角度" value={layout.rotate} min={-180} max={180} step={1} onChange={(rotate) => updateLayout({ rotate })} />
            <NumberField label="OPACITY" hint="纸印浓度" value={layout.opacity} min={0.2} max={1} step={0.01} onChange={(opacity) => updateLayout({ opacity })} />
            <div className="dice-studio-nudge" aria-label="微调图章位置">
              <button type="button" onClick={() => updateLayout({ y: layout.y - 1 })}>↑</button>
              <button type="button" onClick={() => updateLayout({ x: layout.x - 1 })}>←</button>
              <button type="button" onClick={() => updateLayout({ y: layout.y + 1 })}>↓</button>
              <button type="button" onClick={() => updateLayout({ x: layout.x + 1 })}>→</button>
            </div>
          </section>

          <section>
            <h3>预览</h3>
            <NumberField label="PREVIEW" hint="仅影响工作台显示" value={previewScale} min={0.65} max={1.15} step={0.01} onChange={setPreviewScale} />
          </section>

          <section className="dice-studio-json">
            <h3>当前六面参数</h3>
            <pre>{exportText}</pre>
          </section>
        </aside>
      </div>

      {notice && <div className="dice-studio-notice" role="status">{notice}</div>}
    </div>
  );
}
