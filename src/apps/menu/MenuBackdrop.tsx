import { useId } from "react";

const CENTER_X = 1186;
const CENTER_Y = 452;

const OCTAGONS = [272, 374, 492] as const;
const SPOKES = Array.from({ length: 16 }, (_, index) => index * 22.5);
const TICKS = Array.from({ length: 32 }, (_, index) => index * 11.25);

function octagonPoints(radius: number) {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI / 4) * index - Math.PI / 2;
    return `${CENTER_X + Math.cos(angle) * radius},${CENTER_Y + Math.sin(angle) * radius}`;
  }).join(" ");
}

/**
 * 主命令 HUD 的背景场。
 *
 * 图案以命令盘中心为原点向外衰减，延续盘面的圆环、八向轴与菱形节点；
 * 它只负责组织空白，不承担信息，因此始终位于全部 HUD 与人物之下。
 */
export function MenuBackdrop() {
  const uid = useId().replace(/:/g, "");
  const glowId = `menu-field-glow-${uid}`;
  const maskId = `menu-field-mask-${uid}`;
  const maskGradientId = `menu-field-mask-gradient-${uid}`;

  return (
    <svg
      className="menu-backdrop"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id={glowId}
          gradientUnits="userSpaceOnUse"
          cx={CENTER_X}
          cy={CENTER_Y}
          r="690"
        >
          <stop offset="0" stopColor="#6aa6a1" stopOpacity=".24" />
          <stop offset=".38" stopColor="#496f6b" stopOpacity=".12" />
          <stop offset=".72" stopColor="#263b39" stopOpacity=".035" />
          <stop offset="1" stopColor="#101919" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={maskGradientId}
          gradientUnits="userSpaceOnUse"
          cx={CENTER_X}
          cy={CENTER_Y}
          r="690"
        >
          <stop offset="0" stopColor="white" />
          <stop offset=".42" stopColor="white" stopOpacity=".92" />
          <stop offset=".72" stopColor="white" stopOpacity=".42" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="430" y="-250" width="1510" height="1400">
          <rect x="430" y="-250" width="1510" height="1400" fill={`url(#${maskGradientId})`} />
        </mask>
      </defs>

      <rect className="menu-backdrop__wash" width="1600" height="900" fill={`url(#${glowId})`} />

      <g className="menu-backdrop__field" mask={`url(#${maskId})`}>
        <g className="menu-backdrop__spokes" transform={`translate(${CENTER_X} ${CENTER_Y})`}>
          {SPOKES.map((angle, index) => (
            <line
              key={angle}
              className={index % 2 === 0 ? "menu-backdrop__spoke menu-backdrop__spoke--major" : "menu-backdrop__spoke"}
              x1="0"
              y1="-218"
              x2="0"
              y2="-664"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>

        <g className="menu-backdrop__orbits">
          <circle cx={CENTER_X} cy={CENTER_Y} r="236" />
          <circle cx={CENTER_X} cy={CENTER_Y} r="318" />
          <circle className="menu-backdrop__orbit-dashed" cx={CENTER_X} cy={CENTER_Y} r="422" />
          <circle className="menu-backdrop__orbit-faint" cx={CENTER_X} cy={CENTER_Y} r="558" />
        </g>

        <g className="menu-backdrop__octagons">
          {OCTAGONS.map((radius, index) => (
            <polygon
              key={radius}
              className={index === OCTAGONS.length - 1 ? "menu-backdrop__octagon menu-backdrop__octagon--outer" : "menu-backdrop__octagon"}
              points={octagonPoints(radius)}
            />
          ))}
        </g>

        <g className="menu-backdrop__ticks" transform={`translate(${CENTER_X} ${CENTER_Y})`}>
          {TICKS.map((angle, index) => (
            <line
              key={angle}
              x1="0"
              y1={index % 4 === 0 ? -344 : -338}
              x2="0"
              y2="-353"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>

        <g className="menu-backdrop__nodes" transform={`translate(${CENTER_X} ${CENTER_Y})`}>
          {SPOKES.filter((_, index) => index % 2 === 0).map((angle) => (
            <rect
              key={angle}
              x="-5"
              y="-379"
              width="10"
              height="10"
              transform={`rotate(${angle}) rotate(45 0 -374)`}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
