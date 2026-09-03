import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** 预览用的样例台词。够长才看得出「波」,太短一闪就完了。 */
const SAMPLE =
  "潮水退到礁石之下的时候，你会听见有人在念你的名字。别回头——那不是在叫你。";

const TYPED_SKIP = /\s/;

export interface TypingPreviewProps {
  /** ms/字。对应 --abyssa-rp-type-step。 */
  step: number;
  /** 单字淡入时长 ms。对应 --abyssa-rp-type-dur。 */
  dur: number;
  /** 减弱动态效果时预览直接呈现终态,不播放。 */
  reducedMotion?: boolean;
}

/**
 * 打字机实时预览。
 *
 * ============ 为什么这一项必须有预览 ============
 * step 与 dur 是纯感觉量。脱离画面看「13」和「20」这两个数字,没有任何人
 * 能判断哪个是自己想要的;而它们的乘积关系(dur/step = 波宽)更是完全
 * 无法凭数字想象。这是整个设置页里唯一一处「数值本身不携带意义」的地方,
 * 所以也是唯一一处真正需要设计的地方 —— 其余各项(开关、单选)的语义
 * 靠标签就说清了。
 *
 * ============ 刻意复用 rp 的 class 与变量名 ============
 * 逐字 span 用的是 .abyssa-rp__type-char、变量用的是 --abyssa-rp-type-step
 * /-dur,与 rp-typing.css 完全同名。于是这里播放的动画**就是**rp 里那一套,
 * 不是照着做的近似物 —— 改了 rp-typing.css,预览会跟着变,不会偷偷失真。
 * 代价是本组件依赖那份 CSS 存在,这是有意的耦合:预览的价值全在于「所见
 * 即实际效果」,自己另画一套反而消灭了这个价值。
 *
 * ============ 重播用 key 重挂载 ============
 * CSS animation 只在元素挂载时起跑。要重播就得让 span 全部重建 ——
 * 这与 rp App.tsx 用 mountToken 重挂载 RpScene 是同一手法。
 * 不用 animation-play-state 之类的办法:那需要逐个 span 操作,而且暂停后
 * 恢复的相位是不确定的。
 */
export function TypingPreview({ step, dur, reducedMotion }: TypingPreviewProps) {
  const [token, setToken] = useState(0);

  /* 参数一变就自动重播 —— 拖完滑块立刻看到新速度,不用再去按一次重播。
     这是这个预览好不好用的关键:如果每次调完还要手动触发,使用者就会
     停止探索,随便选一个了事。 */
  useEffect(() => {
    setToken((value) => value + 1);
  }, [step, dur]);

  /** 播完的总时长,用于「重播」钮的节流提示。lead 取 rp 的 140ms。 */
  const chars = useMemo(() => Array.from(SAMPLE), []);
  const typedCount = useMemo(
    () => chars.filter((char) => !TYPED_SKIP.test(char)).length,
    [chars]
  );
  const totalMs = 140 + typedCount * step + dur;

  const [playing, setPlaying] = useState(true);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), totalMs);
    return () => window.clearTimeout(timer.current);
  }, [token, totalMs, reducedMotion]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  let index = 0;

  return (
    <div className="settings-preview">
      <div className="settings-preview__head">
        <span className="settings-preview__title">预览</span>
        <button
          type="button"
          className="settings-preview__replay"
          onClick={() => setToken((value) => value + 1)}
          disabled={reducedMotion}
        >
          重播
        </button>
      </div>

      {/* data-kind="say" 是必需的:rp-typing.css 把三个变量声明在
          .abyssa-rp__message[data-kind="say"] 上,不带这个属性,var() 取不到
          值会让整条 animation 声明在计算值阶段失效 —— 那份 CSS 的注释里
          专门记了这个坑(system 分支曾因此静默丢失打字效果)。 */}
      <div
        key={token}
        className="settings-preview__body abyssa-rp__message"
        data-kind="say"
        data-current={reducedMotion ? undefined : true}
        style={
          {
            "--abyssa-rp-type-step": `${step}ms`,
            "--abyssa-rp-type-dur": `${dur}ms`
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <p className="settings-preview__text">
          {reducedMotion
            ? SAMPLE
            : chars.map((char, position) => {
                if (TYPED_SKIP.test(char)) return char;
                const characterIndex = index;
                index += 1;
                return (
                  <span
                    key={position}
                    className="abyssa-rp__type-char"
                    style={{ "--i": characterIndex } as CSSProperties}
                  >
                    {char}
                  </span>
                );
              })}
        </p>
      </div>

      <p className="settings-preview__meta">
        {reducedMotion ? (
          <>已开启减弱动态效果，预览直接呈现终态。</>
        ) : (
          <>
            约 {Math.round(1000 / step)} 字/秒 · 同时渐变约{" "}
            {Math.round(dur / step)} 字
            <span className="settings-preview__state" data-playing={playing || undefined}>
              {playing ? "播放中" : "已结束"}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
