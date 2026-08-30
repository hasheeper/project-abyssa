import { useId } from "react";
import type { ReactNode } from "react";
import { DiamondWatermark } from "../../shared/ui/primitives/DiamondWatermark";

export interface MenuHudFrameProps {
  className?: string;
  label: string;
  side: "left" | "right";
  children: ReactNode;
}

const W = 590;
const H = 132;

/*
 * 这不是一张完整摆进画布的牌子。
 *
 * x=0 一侧是“埋在屏幕外的根”，CSS 会再把它推出画布；屏幕里只看得到
 * 从外部延伸进来的中段。DAY 占外层高阶，四相位占内收一阶，几何转折
 * 与两组信息的分界对齐；末端只用平头切角收住。
 */
const outerPath =
  "M0 2 H218 L238 18 H550 L578 46 V86 L550 114 H238 L218 130 H0 Z";
const innerPath =
  "M0 15 H214 L234 31 H542 L560 51 V81 L542 101 H234 L214 117 H0 Z";

/*
 * 右上资源区现在只是一块承托插槽的暗色凹弧底板。弧线两端延伸到
 * 画布之外，因此屏幕内看不到切断端头；三笔资源自身由 HTML 独立成槽，
 * 不再服从底板弧线的逐级缩进。
 */
/*
 * MenuBackdrop 的主 HUD 圆心是画布 (1186, 452)。资源区原点落在 (1120, 0)，
 * 所以同心圆在这里的局部圆心是 (66, 452)；r=422 与背景主轨道完全一致。
 */
const FUNDS_W = 420;
const FUNDS_H = 224;
const fundsCornerPath =
  "M164 -24 H420 V218 H390 C356 128 280 34 164 -24 Z";
const fundsCornerEdge =
  "M164 -24 C280 34 356 128 390 218 H420";
const fundsCornerInset =
  "M181 -18 C291 40 363 130 397 206 H420";

/** 左右顶角共用的翼形 HUD 外壳；镜像轮廓，内容保持正常方向。 */
export function MenuHudFrame({ className, label, side, children }: MenuHudFrameProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `menu-hud-pattern-${uid}`;
  const fundsSurfaceId = `menu-funds-surface-${uid}`;
  const fundsClipId = `menu-funds-clip-${uid}`;
  const isFunds = side === "right";
  const width = isFunds ? FUNDS_W : W;
  const height = isFunds ? FUNDS_H : H;

  return (
    <section
      className={["menu-hud-frame", className].filter(Boolean).join(" ")}
      data-side={side}
      aria-label={label}
    >
      <svg className="menu-hud-frame__art" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <DiamondWatermark
            as="pattern"
            id={patternId}
            size={34}
            outerFill="rgb(188 218 212 / 8%)"
            innerFill="rgb(210 234 229 / 3.5%)"
            outerOpacity={0.56}
            innerOpacity={0.4}
            innerInset={8}
          />
          <linearGradient id={fundsSurfaceId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e1718" stopOpacity="0.98" />
            <stop offset="0.56" stopColor="#0a1213" stopOpacity="0.99" />
            <stop offset="1" stopColor="#070c0d" stopOpacity="0.99" />
          </linearGradient>
          <clipPath id={fundsClipId}>
            <path d={fundsCornerPath} />
          </clipPath>
        </defs>
        {isFunds ? (
          <>
            <path
              className="menu-hud-frame__funds-shadow"
              d={fundsCornerPath}
              transform="translate(-4 5)"
            />
            <path
              className="menu-hud-frame__funds-surface"
              d={fundsCornerPath}
              fill={`url(#${fundsSurfaceId})`}
            />
            <g clipPath={`url(#${fundsClipId})`}>
              <path
                className="menu-hud-frame__funds-pattern"
                d={fundsCornerPath}
                fill={`url(#${patternId})`}
              />
            </g>
            <path className="menu-hud-frame__funds-corner-outer" d={fundsCornerEdge} />
            <path className="menu-hud-frame__funds-corner-edge" d={fundsCornerEdge} />
            <path className="menu-hud-frame__funds-corner-inner" d={fundsCornerEdge} />
            <path className="menu-hud-frame__funds-corner-ridge" d={fundsCornerEdge} />
            <path className="menu-hud-frame__funds-corner-inset" d={fundsCornerInset} />
          </>
        ) : (
          <>
            <path className="menu-hud-frame__shadow" d={outerPath} transform="translate(0 5)" />
            <path className="menu-hud-frame__surface" d={outerPath} />
            <path className="menu-hud-frame__pattern" d={outerPath} fill={`url(#${patternId})`} />
            <path className="menu-hud-frame__outer" d={outerPath} />
            <path className="menu-hud-frame__middle" d={outerPath} />
            <path className="menu-hud-frame__inner" d={outerPath} />
            <path className="menu-hud-frame__inset" d={innerPath} />
            {/* 四相位作为完整的第二级台阶，左侧直缝正好对齐 DAY 分隔线。 */}
            <path
              className="menu-hud-frame__time-step"
              d="M238 18 H550 L578 46 V86 L550 114 H238 Z"
            />
            <path className="menu-hud-frame__ridge" d="M64 12 H214 L234 28 H542 L560 48" />
            <path className="menu-hud-frame__ridge" d="M64 120 H214 L234 104 H542 L560 84" />
          </>
        )}
      </svg>
      <div className="menu-hud-frame__content">{children}</div>
    </section>
  );
}
