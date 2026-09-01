import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { Emote } from "../../shared/ui/patterns/Emote";
import { PaperDoll } from "../../shared/ui/patterns/PaperDoll";
import type { EmotePlacement } from "../../shared/ui/patterns/emotes";
import { NAME_BY_ID } from "./characters";
import {
  STORAGE_KEY,
  buildDefaults,
  buildEmoteDefaults,
  formatCalibrationTs,
  formatEmotesTs,
  formatJson,
  formatStageCss,
  getAdjust,
  isDirty,
  num,
  parseEmotes,
  parseSnapshot,
  setAdjust
} from "./params";
import type { CharacterParams, EmoteState, ParamMap } from "./params";
import { StudioSeatPanel } from "./StudioSeatPanel";
import { STUDIO_CROP_LABELS } from "./studio-types";
import type { StudioCrop, StudioExportTab, StudioSeat, StudioSeatState } from "./studio-types";
/**
 * 基准 + 偏移,取面板上的实时值。
 *
 * 与 emotes.ts 的 resolveEmotePlacement 算法相同但数据源不同:
 * 那个读源文件里的表(回填后的值),这个读 state(正在调的值)。
 * 预览必须用后者,否则滑块拖动看不到反应。
 */
function mergeEmote(emotes: EmoteState, characterId: string, emoteId: string): EmotePlacement {
  const base = emotes.base[emoteId];
  const adj = getAdjust(emotes.adjust, characterId, emoteId);
  return { x: base.x + adj.x, y: base.y + adj.y, size: base.size + adj.size };
}

export function App() {
  const defaults = useMemo(buildDefaults, []);
  const [params, setParams] = useState<ParamMap>(() => {
    // localStorage 优先:调半小时的参数不该因为一次刷新丢掉。
    // 解析失败就静默回落到默认值 —— 一份坏掉的缓不该让整个工具打不开。
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return parseSnapshot(saved, buildDefaults());
    } catch {
      /* 忽略:损坏的缓存等同于没有缓存 */
    }
    return buildDefaults();
  });

  // ============ 两侧的 active 必须默认一致,否则参数根本没法调 ============
  // active 决定 .abyssa-rp__actor 的 translate:说话中 -2%,静止 +1.5%。
  // 两者相差 3.5% —— 在 825px 的容器上就是 28.9px 的固定落差。
  //
  // 之前左边 true、右边 false,于是左右天生差 28.9px,而这个差值与校准值
  // 毫无关系。在那种状态下想「把两边调齐」,只会把 scale/y 调歪来抵消它。
  // 非说话侧还会被 --abyssa-rp-dim 压到 0.5 不透明度,更难目视比对。
  //
  // 所以默认两边同为说话中(全亮、同高),这才是可比的基线。
  // 要看静止态就用下面的「同步」开关一起切,不要单独切一侧。
  const [left, setLeft] = useState<StudioSeatState>({
    characterId: "abyssa",
    expression: "a",
    active: true,
    idle: "none",
    emote: null
  });
  const [right, setRight] = useState<StudioSeatState>({
    characterId: "elora",
    expression: "a",
    active: true,
    idle: "none",
    emote: null
  });

  // 漫符参数与立绘参数分开存:两者的默认值来源不同(前者来自 emotes.ts,
  // 后者来自 spriteCalibration.ts),合成一个 state 后任一方改结构都要动另一方。
  const emoteDefaults = useMemo(buildEmoteDefaults, []);
  const [emotes, setEmotes] = useState<EmoteState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return parseEmotes(saved, buildEmoteDefaults());
    } catch {
      /* 同上:损坏或旧版(无 emotes 字段)的缓存等同于没有缓存 */
    }
    return buildEmoteDefaults();
  });

  // 说话状态同步:开启时切一侧则两侧一起变,保证高度始终可比。
  // 默认开启 —— 单独切一侧是「刻意要看差异」的少数情况,不该是默认行为。
  const [syncActive, setSyncActive] = useState(true);

  // 一次性动作直接在 .actor-beat 元素上 animate(),不走 React 状态 ——
  // 动作是「播一次就结束」的瞬时事件,塞进状态只会多一次无谓的重渲染,
  // 而且重渲染本身可能打断正在播的动画。
  const leftBeat = useRef<HTMLDivElement>(null);
  const rightBeat = useRef<HTMLDivElement>(null);

  // 默认 knee(中距离)—— 与 RpScene 的默认值一致。
  // 这一点必须对齐:studio 是用来调 rp 里的观感的,取景默认值不同的话,
  // 调出来的 doll-h / 校准值搬回 rp 就对不上。
  const [crop, setCrop] = useState<StudioCrop>("knee");
  const [guides, setGuides] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [exportTab, setExportTab] = useState<StudioExportTab | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, formatJson(params, emotes));
    } catch {
      /* 隐私模式下 localStorage 会抛异常,不该影响使用 */
    }
  }, [params, emotes]);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
  }, []);

  const setOne = useCallback((id: string, next: CharacterParams) => {
    setParams((prev) => ({ ...prev, [id]: next }));
  }, []);

  /** 基准是逐漫符的全局值 —— 两侧面板改的是同一份数据,不按席位分。 */
  const setEmoteBase = useCallback((emoteId: string, next: EmotePlacement) => {
    setEmotes((prev) => ({ ...prev, base: { ...prev.base, [emoteId]: next } }));
  }, []);

  /** 偏移按角色 × 漫符落位。全零时删条目,理由见 params.ts 的 setAdjust。 */
  const setEmoteAdjust = useCallback((characterId: string, emoteId: string, next: EmotePlacement) => {
    setEmotes((prev) => ({ ...prev, adjust: setAdjust(prev.adjust, characterId, emoteId, next) }));
  }, []);

  const exportText = useMemo(() => {
    if (exportTab === "ts") return formatCalibrationTs(params);
    if (exportTab === "css") return formatStageCss(params);
    if (exportTab === "emote") return formatEmotesTs(emotes);
    if (exportTab === "json") return formatJson(params, emotes);
    return "";
  }, [exportTab, params, emotes]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1600);
    } catch {
      /* 无剪贴板权限时用户仍可手动选中文本框内容 */
    }
  };

  const importJson = () => {
    const text = window.prompt("粘贴之前导出的 JSON 快照:");
    if (!text) return;
    try {
      // 两块一起解析。分开做会有半成功状态:立绘参数进去了、漫符没进去,
      // 而两者在同一份快照里,那种状态无法解释也无法回退。
      const nextParams = parseSnapshot(text, buildDefaults());
      const nextEmotes = parseEmotes(text, buildEmoteDefaults());
      setParams(nextParams);
      setEmotes(nextEmotes);
    } catch {
      window.alert("解析失败 —— 请确认粘贴的是完整的 JSON 快照。");
    }
  };

  const renderSeat = (seat: StudioSeat, state: StudioSeatState, beatRef: RefObject<HTMLDivElement | null>) => {
    const p = params[state.characterId];
    return (
      <div className="abyssa-rp__seat abyssa-frame" data-seat={seat}>
        <span className="abyssa-frame__ornaments" aria-hidden="true">
          <i data-corner="tl" />
          <i data-corner="tr" />
          <i data-corner="bl" />
          <i data-corner="br" />
        </span>
        <div
          className="abyssa-rp__actor"
          data-character={state.characterId}
          data-active={state.active ? "true" : undefined}
          // 内联变量会压过 rp.css 末尾那张逐角色表 —— 正是我们要的:
          // 面板上的实时值优先,表里的旧值不干扰预览。
          style={
            {
              "--abyssa-rp-doll-h": `${num(p.stage.h)}%`,
              "--abyssa-rp-doll-x": `${num(p.stage.x)}%`,
              "--abyssa-rp-doll-y": `${num(p.stage.y)}%`
            } as CSSProperties
          }
        >
          <div className="abyssa-rp__actor-body">
            {/* 两层专职动画层,与 RpScene 的结构逐字一致 —— 这一点很重要:
                studio 调出来的手感必须与 rp 里的实际表现等价,
                层级一旦不同,transform 的叠加关系就变了。 */}
            <div className="abyssa-rp__actor-idle" data-idle={state.idle}>
              <div className="abyssa-rp__actor-beat" ref={beatRef}>
                <PaperDoll
                  characterId={state.characterId}
                  expression={state.expression}
                  crop={crop}
                  calibration={p.cal}
                />
                {/* 漫符挂在 beat 内、PaperDoll 之后 —— 与它在 rp 里的位置一致,
                    所以跟着动作一起动、坐标系是立绘盒子。

                    placement 传的是「基准 + 本席位偏移」的合成值,不走
                    resolveEmotePlacement 读表:表里是上次回填的旧值,
                    而面板上的实时值才是要预览的那个。 */}
                {state.emote && (
                  <Emote
                    emoteId={state.emote}
                    characterId={state.characterId}
                    placement={mergeEmote(emotes, state.characterId, state.emote)}
                    // 冻结动画时换静帧 —— APNG 停不下来(见 emote.css),
                    // 而逐帧对齐位置时一个跳动的符号是没法瞄准的。
                    still={freeze}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        {guides && (
          <span className="studio-guides" aria-hidden="true">
            <i data-axis="v" />
            <i data-axis="h3" />
            <i data-axis="h6" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="studio" data-freeze={freeze || undefined}>
      <header className="studio-bar">
        <div className="studio-bar__title">
          <p>ABYSSA · SPRITE STUDIO</p>
          <h1>立绘参数工作台</h1>
        </div>

        <div className="studio-bar__actions">
          {/* 取景距离。默认中距离(knee),与 rp 一致。
              近距离/全身用于对照 —— 换取景后 doll-h 的观感会变,
              所以调参数时要在**目标取景**下调,不是随手切着看。 */}
          <span className="studio-seg">
            {(["knee", "upper", "full"] as StudioCrop[]).map((c) => (
              <button key={c} type="button" data-on={crop === c || undefined} onClick={() => setCrop(c)}>
                {STUDIO_CROP_LABELS[c]}
              </button>
            ))}
          </span>
          <button type="button" className="studio-btn" data-on={guides || undefined} onClick={() => setGuides(!guides)}>
            辅助线
          </button>
          <button
            type="button"
            className="studio-btn"
            data-on={freeze || undefined}
            title="关掉过渡与换图淡入,便于逐帧对齐"
            onClick={() => setFreeze(!freeze)}
          >
            冻结动画
          </button>
          <button
            type="button"
            className="studio-btn"
            data-on={syncActive || undefined}
            title="两侧说话状态联动。关掉后可单独切一侧,但两边会差 28.9px(上浮 -2% vs 静止 +1.5%),此时不要目视比对高度"
            onClick={() => {
              const next = !syncActive;
              setSyncActive(next);
              // 开启同步的那一刻立即对齐,否则会停在一个不可比的中间状态。
              // 以左侧为准:面板顺序左→右,左是先读到的那个。
              if (next) setRight((s) => ({ ...s, active: left.active }));
            }}
          >
            同步说话态
          </button>
          <button type="button" className="studio-btn" onClick={() => setExportTab("ts")}>
            导出
          </button>
          <button type="button" className="studio-btn studio-btn--ghost" onClick={importJson}>
            导入
          </button>
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            onClick={() => {
              if (window.confirm("重置全部十个角色的参数?")) setParams(buildDefaults());
            }}
          >
            全部重置
          </button>
        </div>
      </header>

      <div className="studio-body">
        <StudioSeatPanel
          seat="left"
          state={left}
          params={params[left.characterId]}
          dirty={isDirty(left.characterId, params[left.characterId], defaults)}
          beatRef={leftBeat}
          emotes={emotes}
          emoteDefaults={emoteDefaults}
          onSeat={(patch) => {
            setLeft((s) => ({ ...s, ...patch }));
            // active 同步:两侧高度差 28.9px 全部来自它,单独切一侧
            // 就失去了可比基线(详见 syncActive 的声明处)。
            if (syncActive && patch.active !== undefined) {
              setRight((s) => ({ ...s, active: patch.active! }));
            }
          }}
          onParams={(next) => setOne(left.characterId, next)}
          onResetOne={() => setOne(left.characterId, defaults[left.characterId])}
          onEmoteBase={setEmoteBase}
          onEmoteAdjust={(emoteId, next) => setEmoteAdjust(left.characterId, emoteId, next)}
        />

        <main className="studio-stage">
          {/* 直接复用 .abyssa-rp 的三栏 Grid 与席位规则。
              中栏留空但**必须保留**:席位宽度是 grid-template-columns 的一部分,
              抽掉中栏会让两侧框宽变成 1fr,与 rp 里的实际几何不再等价,
              那样调出来的参数搬回 rp 就是错的。 */}
          <div className="abyssa-rp">
            {renderSeat("left", left, leftBeat)}
            <div className="studio-stage__center">
              <p>中栏(rp 里是消息流)</p>
              <span>此处留空以保持席位几何与 rp 完全一致</span>
            </div>
            {renderSeat("right", right, rightBeat)}
          </div>
        </main>

        <StudioSeatPanel
          seat="right"
          state={right}
          params={params[right.characterId]}
          dirty={isDirty(right.characterId, params[right.characterId], defaults)}
          beatRef={rightBeat}
          emotes={emotes}
          emoteDefaults={emoteDefaults}
          onSeat={(patch) => {
            setRight((s) => ({ ...s, ...patch }));
            if (syncActive && patch.active !== undefined) {
              setLeft((s) => ({ ...s, active: patch.active! }));
            }
          }}
          onParams={(next) => setOne(right.characterId, next)}
          onResetOne={() => setOne(right.characterId, defaults[right.characterId])}
          onEmoteBase={setEmoteBase}
          onEmoteAdjust={(emoteId, next) => setEmoteAdjust(right.characterId, emoteId, next)}
        />
      </div>

      {exportTab && (
        <div className="studio-export" role="dialog" aria-label="导出参数">
          <div className="studio-export__box">
            <header>
              <span className="studio-seg">
                <button type="button" data-on={exportTab === "ts" || undefined} onClick={() => setExportTab("ts")}>
                  spriteCalibration.ts
                </button>
                <button type="button" data-on={exportTab === "css" || undefined} onClick={() => setExportTab("css")}>
                  rp.css
                </button>
                <button type="button" data-on={exportTab === "emote" || undefined} onClick={() => setExportTab("emote")}>
                  emotes.ts
                </button>
                <button type="button" data-on={exportTab === "json" || undefined} onClick={() => setExportTab("json")}>
                  JSON 快照
                </button>
              </span>
              <button type="button" className="studio-btn" onClick={() => setExportTab(null)}>
                关闭
              </button>
            </header>
            <p className="studio-export__hint">
              {exportTab === "ts" && "替换 src/shared/ui/patterns/spriteCalibration.ts 里 CHARACTER_CALIBRATION 整个对象。"}
              {exportTab === "css" && "替换 src/shared/ui/styles/rp.css 末尾「逐角色立绘调整表」的那十行。"}
              {exportTab === "emote" &&
                "替换 src/shared/ui/patterns/emotes.ts 里 EMOTE_PLACEMENT 与 EMOTE_ADJUST 两个对象。两张必须一起替换 —— 偏移是相对基准的增量。"}
              {exportTab === "json" && "保存这段文本,之后用「导入」恢复整个会话。"}
            </p>
            <textarea readOnly value={exportText} spellCheck={false} />
            <button type="button" className="studio-btn" onClick={copy}>
              {copied ? "✓ 已复制" : "复制到剪贴板"}
            </button>
          </div>
        </div>
      )}

      <footer className="studio-foot">
        <span>
          左 {NAME_BY_ID[left.characterId]} · {left.expression}
        </span>
        <span>参数自动保存在本地,刷新不丢</span>
        <span>
          右 {NAME_BY_ID[right.characterId]} · {right.expression}
        </span>
      </footer>
    </div>
  );
}
