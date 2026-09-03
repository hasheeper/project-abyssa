import type { PartyFigureCalibration } from "../../content/characters/partyFigureCalibration";
import type { PartyFigureCatalogEntry } from "../../assets/map/party-figures/catalog";
import { PARTY_FIGURE_RANGES } from "./party-figure-model";

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
  const update = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <label className="party-figure-inspector__field">
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => update(event.target.value)}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => update(event.target.value)}
        />
      </div>
    </label>
  );
}

export interface PartyFigureInspectorProps {
  entry: PartyFigureCatalogEntry;
  calibration: PartyFigureCalibration;
  dirty: boolean;
  onChange: (next: PartyFigureCalibration) => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
}

export function PartyFigureInspector({
  entry,
  calibration,
  dirty,
  onChange,
  onResetCurrent,
  onResetAll
}: PartyFigureInspectorProps) {
  const set = <K extends keyof PartyFigureCalibration>(key: K, value: PartyFigureCalibration[K]) => {
    onChange({ ...calibration, [key]: value });
  };

  return (
    <aside className="party-figure-inspector" aria-label="当前立绘参数">
      <header>
        <span className="party-figure-inspector__portrait">
          <img src={entry.url} alt="" draggable={false} />
        </span>
        <div>
          <p>CURRENT FIGURE</p>
          <h2>{entry.name}</h2>
          <code>{entry.id}</code>
        </div>
        {dirty && <i>已修改</i>}
      </header>

      <section>
        <div className="party-figure-inspector__section-title">
          <h3>画布校准</h3>
          <span>实时预览</span>
        </div>
        <p className="party-figure-inspector__note">
          缩放以脚底中心为原点。正 X 向右，正 Y 向上；数值是相对 512 画布的百分比。
        </p>
        <NumberField
          label="缩放"
          hint="scale"
          value={calibration.scale}
          {...PARTY_FIGURE_RANGES.scale}
          onChange={(value) => set("scale", value)}
        />
        <NumberField
          label="水平"
          hint="x · %"
          value={calibration.x}
          {...PARTY_FIGURE_RANGES.x}
          onChange={(value) => set("x", value)}
        />
        <NumberField
          label="垂直"
          hint="y · %"
          value={calibration.y}
          {...PARTY_FIGURE_RANGES.y}
          onChange={(value) => set("y", value)}
        />

        <label className="party-figure-inspector__flip">
          <input
            type="checkbox"
            checked={calibration.flipX}
            onChange={(event) => set("flipX", event.target.checked)}
          />
          <span>
            <b>水平翻转</b>
            <small>flipX · 统一动作朝向</small>
          </span>
        </label>
      </section>

      <section className="party-figure-inspector__readout" aria-label="参数读数">
        <span><small>SCALE</small><b>{calibration.scale.toFixed(3)}</b></span>
        <span><small>X</small><b>{calibration.x.toFixed(2)}%</b></span>
        <span><small>Y</small><b>{calibration.y.toFixed(2)}%</b></span>
        <span><small>FLIP</small><b>{calibration.flipX ? "YES" : "NO"}</b></span>
      </section>

      <footer>
        <button type="button" onClick={onResetCurrent} disabled={!dirty}>重置当前</button>
        <button type="button" onClick={onResetAll}>重置全部</button>
      </footer>
    </aside>
  );
}
