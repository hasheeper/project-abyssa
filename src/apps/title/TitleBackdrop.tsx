import { useId } from "react";
import { TITLE_FIELD_CENTRE_X, TITLE_FIELD_CENTRE_Y } from "./titleGeometry";

/* ============ 标题画面背景场 ============
 *
 * 沿用枢纽背景场的语汇(八向轴 + 环 + 菱形 + 刻度 + 节点),
 * 让两个界面认得出是同一套系统;但原点、半径、密度全部为本构图重算 ——
 * 枢纽的原点在右侧命令盘 (1186, 452),这里在字标中心。
 *
 * 没有下沉成共享组件是刻意的:两处的原点/半径/密度都要各自调,
 * 抽出去只会得到一个参数比代码还多的伪共享件。模块边界也禁止
 * app 互相 import(scripts/check-module-boundaries.mjs)。
 *
 * 它只负责组织空白,不承担任何信息,所以永远在字标与命令列之下。
 */

/* 外部法阵与 Logo 自带印章共用同一原点 —— 见 titleGeometry.ts。
   若对准画布中线,整片图案会落在 Logo 下方约 188px。 */
const CENTER_X = TITLE_FIELD_CENTRE_X;
const CENTER_Y = TITLE_FIELD_CENTRE_Y;

/** 与 logo 内部 stamp 的菱形同构,但半径更大,读起来像它向外的余波。 */
const DIAMONDS = [366, 452, 556] as const;
const SPOKES = Array.from({ length: 16 }, (_, index) => index * 22.5);
const TICKS = Array.from({ length: 32 }, (_, index) => index * 11.25);

function diamondPoints(radius: number) {
  return [
    `${CENTER_X},${CENTER_Y - radius}`,
    `${CENTER_X + radius},${CENTER_Y}`,
    `${CENTER_X},${CENTER_Y + radius}`,
    `${CENTER_X - radius},${CENTER_Y}`
  ].join(" ");
}

export function TitleBackdrop() {
  const uid = useId().replace(/:/g, "");
  const glowId = `title-field-glow-${uid}`;
  const maskId = `title-field-mask-${uid}`;
  const maskGradientId = `title-field-mask-gradient-${uid}`;

  return (
    <svg
      className="title-backdrop"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} gradientUnits="userSpaceOnUse" cx={CENTER_X} cy={CENTER_Y} r="760">
          {/* 底光跟随主题。SVG 的 stop-color 支持 CSS 变量,所以皮肤切换
              不需要重建渐变节点。 */}
          <stop offset="0" stopColor="var(--title-glow-core)" stopOpacity=".24" />
          <stop offset=".36" stopColor="var(--title-glow-mid)" stopOpacity=".12" />
          <stop offset=".7" stopColor="var(--title-glow-far)" stopOpacity=".04" />
          <stop offset="1" stopColor="var(--title-canvas)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={maskGradientId} gradientUnits="userSpaceOnUse" cx={CENTER_X} cy={CENTER_Y} r="760">
          <stop offset="0" stopColor="white" stopOpacity=".42" />
          <stop offset=".3" stopColor="white" stopOpacity=".92" />
          <stop offset=".6" stopColor="white" stopOpacity=".34" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="-400" width="1600" height="1700">
          <rect x="0" y="-400" width="1600" height="1700" fill={`url(#${maskGradientId})`} />
        </mask>
      </defs>

      <rect className="title-backdrop__wash" width="1600" height="900" fill={`url(#${glowId})`} />

      {/*
        遮罩与底光**不参与自转** —— 径向衰减一转就会露出 mask 的矩形边界。
        自转只施加在 `__spin` 空壳上:壳没有 transform 属性,内容组带
        translate。SVG 的 transform 属性就是 CSS transform 属性,把动画直接
        加在已有 translate 的组上会整个覆盖掉它,图案会飞到左上角。
      */}
      <g className="title-backdrop__field" mask={`url(#${maskId})`}>
        <g className="title-backdrop__spin title-backdrop__spin--spokes">
          <g transform={`translate(${CENTER_X} ${CENTER_Y})`}>
            {SPOKES.map((angle, index) => (
              <line
                key={angle}
                className={
                  index % 4 === 0
                    ? "title-backdrop__spoke title-backdrop__spoke--major"
                    : "title-backdrop__spoke"
                }
                x1="0"
                y1="-300"
                x2="0"
                y2="-742"
                transform={`rotate(${angle})`}
              />
            ))}
          </g>
        </g>

        {/* 同心环不转:正圆转起来看不出变化,只会白耗合成层。 */}
        <g className="title-backdrop__orbits">
          <circle cx={CENTER_X} cy={CENTER_Y} r="322" />
          <circle className="title-backdrop__orbit-dashed" cx={CENTER_X} cy={CENTER_Y} r="486" />
          <circle className="title-backdrop__orbit-faint" cx={CENTER_X} cy={CENTER_Y} r="640" />
        </g>

        <g className="title-backdrop__spin title-backdrop__spin--diamonds">
          <g className="title-backdrop__diamonds">
            {DIAMONDS.map((radius, index) => (
              <polygon
                key={radius}
                className={
                  index === DIAMONDS.length - 1
                    ? "title-backdrop__diamond title-backdrop__diamond--outer"
                    : "title-backdrop__diamond"
                }
                points={diamondPoints(radius)}
              />
            ))}
          </g>
        </g>

        <g className="title-backdrop__spin title-backdrop__spin--ticks">
          <g className="title-backdrop__ticks" transform={`translate(${CENTER_X} ${CENTER_Y})`}>
            {TICKS.map((angle, index) => (
              <line
                key={angle}
                x1="0"
                y1={index % 4 === 0 ? -406 : -400}
                x2="0"
                y2="-416"
                transform={`rotate(${angle})`}
              />
            ))}
          </g>
        </g>

        {/* 节点跟随刻度层一起转,否则会与刻度错开。 */}
        <g className="title-backdrop__spin title-backdrop__spin--ticks">
          <g className="title-backdrop__nodes" transform={`translate(${CENTER_X} ${CENTER_Y})`}>
            {SPOKES.filter((_, index) => index % 4 === 0).map((angle) => (
              <rect
                key={angle}
                x="-6"
                y="-458"
                width="12"
                height="12"
                transform={`rotate(${angle}) rotate(45 0 -452)`}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
