import type { RefObject } from "react";
import { EMOTES, EMOTE_LABELS } from "../../shared/ui/patterns/emotes";
import type { EmotePlacement } from "../../shared/ui/patterns/emotes";
import { IDLE_LABELS, MOTION_LABELS, playMotion } from "../../shared/ui/patterns/motions";
import type { IdleId, MotionId } from "../../shared/ui/patterns/motions";
import { ROSTER, expressionsOf, labelOf, NAME_BY_ID } from "./characters";
import { EMOTE_RANGES, RANGES, getAdjust, hasAdjust } from "./params";
import type { CharacterParams, EmoteState } from "./params";
import type { StudioSeat, StudioSeatState } from "./studio-types";

const MOTION_IDS = Object.keys(MOTION_LABELS) as MotionId[];
const IDLE_IDS = Object.keys(IDLE_LABELS) as IdleId[];

function Field({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="studio-field">
      <span className="studio-field__label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="studio-field__row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          className="studio-field__num"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            // 输入框允许空串与中间态,过滤掉 NaN 才不会让立绘瞬间消失
            if (Number.isFinite(v)) onChange(v);
          }}
        />
      </span>
    </label>
  );
}

export function StudioSeatPanel({
  seat,
  state,
  params,
  dirty,
  beatRef,
  emotes,
  onSeat,
  onParams,
  onResetOne,
  onEmoteBase,
  onEmoteAdjust
}: {
  seat: StudioSeat;
  state: StudioSeatState;
  params: CharacterParams;
  dirty: boolean;
  /** 指向该席位的 .actor-beat 层 —— 一次性动作直接在这个元素上 animate()。 */
  beatRef: RefObject<HTMLDivElement | null>;
  emotes: EmoteState;
  onSeat: (patch: Partial<StudioSeatState>) => void;
  onParams: (next: CharacterParams) => void;
  onResetOne: () => void;
  onEmoteBase: (emoteId: string, next: EmotePlacement) => void;
  onEmoteAdjust: (emoteId: string, next: EmotePlacement) => void;
}) {
  const expressions = expressionsOf(state.characterId);
  const emoteId = state.emote;
  const emoteBase = emoteId ? emotes.base[emoteId] : null;
  const emoteAdj = emoteId ? getAdjust(emotes.adjust, state.characterId, emoteId) : null;
  const setCal = (patch: Partial<CharacterParams["cal"]>) =>
    onParams({ ...params, cal: { ...params.cal, ...patch } });
  const setStage = (patch: Partial<CharacterParams["stage"]>) =>
    onParams({ ...params, stage: { ...params.stage, ...patch } });

  return (
    <aside className="studio-panel" data-seat={seat}>
      <header className="studio-panel__head">
        <span className="studio-panel__seat">{seat === "left" ? "左席位" : "右席位"}</span>
        {dirty && <span className="studio-panel__dirty" title="与默认值有差异">已改动</span>}
      </header>

      <select
        className="studio-select"
        value={state.characterId}
        onChange={(e) => {
          // 换角色时表情回落到 a:上一个角色的专属表情(如 star-eyes)
          // 在新角色身上多半不存在,不重置会渲染出 undefined。
          onSeat({ characterId: e.target.value, expression: "a" });
        }}
      >
        {ROSTER.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="studio-toggle"
        data-on={state.active || undefined}
        onClick={() => onSeat({ active: !state.active })}
      >
        {state.active ? "● 说话中" : "○ 静止"}
      </button>

      <section className="studio-group">
        <h3>表情</h3>
        <div className="studio-exprs">
          {expressions.map((key) => (
            <button
              key={key}
              type="button"
              data-on={state.expression === key || undefined}
              data-special={!(key.length === 1) || undefined}
              title={labelOf(key)}
              onClick={() => onSeat({ expression: key })}
            >
              {key}
            </button>
          ))}
        </div>
        <p className="studio-exprs__label">{labelOf(state.expression)}</p>
      </section>

      {/* 动作 —— 一期只做手动触发。手感必须先调对,而调手感需要反复单点触发,
          接入消息流反而碍事(那是二期的事)。 */}
      <section className="studio-group">
        <h3>
          动作 <em>一次性</em>
        </h3>
        <div className="studio-motions">
          {MOTION_IDS.map((id) => (
            <button key={id} type="button" onClick={() => playMotion(beatRef.current, id)}>
              {MOTION_LABELS[id]}
            </button>
          ))}
        </div>

        <h3 className="studio-group__sub">
          持续状态 <em>互斥</em>
        </h3>
        <div className="studio-motions">
          {IDLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              data-on={state.idle === id || undefined}
              onClick={() => onSeat({ idle: id })}
            >
              {IDLE_LABELS[id]}
            </button>
          ))}
        </div>
      </section>

      <section className="studio-group">
        <h3>
          画布级 <em>spriteCalibration.ts</em>
        </h3>
        <p className="studio-group__note">
          补偿 PSD 画布本身的裁切差异。<b>全局生效</b>,rp / novel / battle 共用。
        </p>
        <Field
          label="scale"
          hint="缩放"
          value={params.cal.scale}
          {...RANGES.scale}
          onChange={(v) => setCal({ scale: v })}
        />
        <Field
          label="x"
          hint="右移为正"
          value={params.cal.x}
          {...RANGES.calXY}
          onChange={(v) => setCal({ x: v })}
        />
        <Field
          label="y"
          hint="下移为正"
          value={params.cal.y}
          {...RANGES.calXY}
          onChange={(v) => setCal({ y: v })}
        />
      </section>

      <section className="studio-group">
        <h3>
          舞台级 <em>rp.css</em>
        </h3>
        <p className="studio-group__note">
          只管这个舞台上的观感。<b>仅 rp 生效</b> —— 不要在这里补画布问题。
        </p>
        <Field
          label="doll-h"
          hint="% 框内高度"
          value={params.stage.h}
          {...RANGES.h}
          onChange={(v) => setStage({ h: v })}
        />
        <Field
          label="doll-x"
          hint="% 自身宽"
          value={params.stage.x}
          {...RANGES.stageXY}
          onChange={(v) => setStage({ x: v })}
        />
        <Field
          label="doll-y"
          hint="% 自身高"
          value={params.stage.y}
          {...RANGES.stageXY}
          onChange={(v) => setStage({ y: v })}
        />
      </section>

      {/* 漫符 —— 两级参数,与上面「画布级 / 舞台级」是同一套分工。
          放在这两组之后:漫符挂在立绘头顶,立绘本身的位置没定下来之前
          调漫符是白费的(头的位置还会动)。面板顺序即是推荐的调参顺序。 */}
      <section className="studio-group">
        <h3>
          漫符 <em>{emoteId ? EMOTE_LABELS[emoteId] : "未选择"}</em>
        </h3>
        <div className="studio-emotes">
          {EMOTES.map(({ id, label, origin }) => (
            <button
              key={id}
              type="button"
              data-on={emoteId === id || undefined}
              data-tuned={hasAdjust(emotes.adjust, state.characterId, id) || undefined}
              title={`${label} · ${origin}`}
              onClick={() => onSeat({ emote: emoteId === id ? null : id })}
            >
              {label}
            </button>
          ))}
        </div>

        {emoteId && emoteBase && emoteAdj ? (
          <>
            <h3 className="studio-group__sub">
              基准 <em>逐漫符 · 全局</em>
            </h3>
            <p className="studio-group__note">
              漫符自身画布的构图差异。<b>十个角色共用</b> —— 不要在这里补某个角色的问题。
            </p>
            <Field
              label="x"
              hint="% 立绘宽"
              value={emoteBase.x}
              {...EMOTE_RANGES.base.x}
              onChange={(v) => onEmoteBase(emoteId, { ...emoteBase, x: v })}
            />
            <Field
              label="y"
              hint="% 立绘宽"
              value={emoteBase.y}
              {...EMOTE_RANGES.base.y}
              onChange={(v) => onEmoteBase(emoteId, { ...emoteBase, y: v })}
            />
            <Field
              label="size"
              hint="% 立绘宽"
              value={emoteBase.size}
              {...EMOTE_RANGES.base.size}
              onChange={(v) => onEmoteBase(emoteId, { ...emoteBase, size: v })}
            />

            <h3 className="studio-group__sub">
              偏移 <em>本角色 × 本漫符</em>
            </h3>
            <p className="studio-group__note">
              叠加在基准之上的<b>增量</b>,只影响 {NAME_BY_ID[state.characterId]} 的这一个漫符。
              发型高度与头身比的差异调在这里。
            </p>
            <Field
              label="+x"
              hint="增量"
              value={emoteAdj.x}
              {...EMOTE_RANGES.adjust.x}
              onChange={(v) => onEmoteAdjust(emoteId, { ...emoteAdj, x: v })}
            />
            <Field
              label="+y"
              hint="增量"
              value={emoteAdj.y}
              {...EMOTE_RANGES.adjust.y}
              onChange={(v) => onEmoteAdjust(emoteId, { ...emoteAdj, y: v })}
            />
            <Field
              label="+size"
              hint="增量"
              value={emoteAdj.size}
              {...EMOTE_RANGES.adjust.size}
              onChange={(v) => onEmoteAdjust(emoteId, { ...emoteAdj, size: v })}
            />

            {/* 只清偏移,不动基准 —— 基准是十人共用的,从单个席位面板上
                一键清掉它会连带影响其余九人,那是意料之外的破坏。 */}
            <button
              type="button"
              className="studio-btn studio-btn--ghost studio-emote-reset"
              onClick={() => onEmoteAdjust(emoteId, { x: 0, y: 0, size: 0 })}
            >
              清除本角色偏移
            </button>
          </>
        ) : (
          <p className="studio-group__note studio-emotes__hint">
            选一个漫符开始调整。右上角有小点的表示 {NAME_BY_ID[state.characterId]} 已单独调过。
          </p>
        )}
      </section>

      <button type="button" className="studio-btn studio-btn--ghost" onClick={onResetOne}>
        重置本角色
      </button>
    </aside>
  );
}
