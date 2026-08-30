import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "./IconButton";
import { Nameplate } from "./Nameplate";
import { RpgFrame } from "./RpgFrame";
import type { RpgFrameProps } from "./RpgFrame";

/* ============ 模态 ============
 *
 * 库里原本**没有**任何共享的遮罩/对话框组件,4 个应用各自手搓了一个,
 * 无障碍水准参差不齐(dice 的 .result-overlay 连 role="dialog" 都没有;
 * mansion 的 ADV 遮罩靠"任何 Tab 都 preventDefault 后跳到关闭键"凑出
 * 两节点陷阱)。这里把它收成一个原语。
 *
 * 三条不能改的实现约束:
 *
 * 1. **不 portal。** 把节点搬到 document.body 会逃出 Stage 的 scale(),
 *    模态立刻按未缩放尺寸渲染、并脱离 1600x900 画布。必须内联。
 *
 * 2. **scrim 用 position: fixed**(见 items.css)。在 transform 祖先内,
 *    fixed 的包含块是那个被变换的元素,于是遮罩正好裁在画布上,不会盖到
 *    画布外的黑边。
 *
 * 3. **不锁 body 滚动。** 画布内不存在页面滚动;去动 document.body.style
 *    只会在别的地方引发布局抖动。滚动交给面板内部的 overflow。
 *
 * 焦点陷阱是真的循环遍历,不是"Tab 一律跳到关闭键"。退出动画靠 data-open
 * 属性 + transition 驱动 —— keyframe-on-mount 只能做入场,做不了退场。
 *
 * ============ 不要在这里放 MetalCorner ============
 * 上一版给四角挂了 MetalCorner,是错的。那份美术是 216x198 的黄铜角件,
 * 只有 tl 一份图、其余靠镜像,它是为 shop/map 的 1334x889 画板设计的;
 * 塞进模态就得压成 74x68,长宽比被破坏、铆钉和倒角糊成一团。模态的层级
 * 语义是"浮在界面之上的临时面板",不是"镶在墙上的画框",本就不该有
 * 画框级的金属件。质感由 RpgFrame 的三层描边 + 顶部招牌承担。
 */

export interface RpgModalProps {
  open: boolean;
  onClose: () => void;
  /** 标题。用作 aria-label,并渲染在面板头部(除非给了 header)。 */
  title: string;
  /** 自定义头部,覆盖默认的标题行。 */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** 点遮罩是否关闭,默认 true。强制选择的模态传 false。 */
  dismissOnBackdrop?: boolean;
  /** Escape 是否关闭,默认 true。 */
  dismissOnEscape?: boolean;
  /** 顶部名牌主名(中文)。给了才渲染名牌。 */
  signboard?: string;
  /** 名牌副名(罗马字),接在主名右侧作小字。 */
  signboardSecondary?: string;
  /** 是否渲染右上角关闭键,默认 true。 */
  closable?: boolean;
  frameVariant?: RpgFrameProps["variant"];
  className?: string;
  panelClassName?: string;
  /** 关闭后要把焦点还给谁。缺省则还给打开前的 activeElement。 */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function RpgModal({
  open,
  onClose,
  title,
  header,
  children,
  footer,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  signboard,
  signboardSecondary,
  closable = true,
  frameVariant = "dark",
  className,
  panelClassName,
  returnFocusRef
}: RpgModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  /* 打开时记住来源焦点,关闭时归还。rAF 是必需的:关闭那一帧目标元素可能
     还没恢复可聚焦状态(inert 刚撤、或刚被重新挂载)。 */
  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (open) return;
    const target = restoreRef.current;
    if (!target) return;
    restoreRef.current = null;
    const frame = requestAnimationFrame(() => target.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && dismissOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement
      );
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      // 真正的环形陷阱:只在两端接管,中间交给浏览器原生顺序。
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      }
    },
    [dismissOnEscape, onClose]
  );

  if (!open) return null;

  return (
    <div
      className={cx("abyssa-modal", className)}
      data-open={open ? "true" : "false"}
      onMouseDown={(event) => {
        // 只认按在遮罩本身上的,避免面板内拖拽松手时误关。
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cx("abyssa-modal__panel", panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
{/* 名牌骑在面板上边缘。用 Nameplate 而不是 RpgHeader:
            RpgHeader 是 660x116 的横幅招牌,为整屏顶部设计,压到模态上必须
            缩到 .78 才放得下,字就糊了;而 Nameplate 本身就是"主名 + 罗马字
            副名"的六边形牌,尺寸量级和模态标题匹配,且它是全库通用的姓名牌。 */}
        {signboard && (
          <div className="abyssa-modal__signboard" aria-hidden="true">
            <Nameplate name={signboard} secondaryName={signboardSecondary} />
          </div>
        )}
        {/* 关闭键是 __panel 的直接子元素,不放进 RpgFrame —— RpgFrame 带
            isolation:isolate 和三层描边阴影,负偏移的角标钉在里面会被裁掉。 */}
        {closable && (
          <IconButton
            className="abyssa-modal__close"
            label={`关闭${title}`}
            icon="close"
            size="sm"
            onClick={onClose}
          />
        )}
        <RpgFrame variant={frameVariant} padding="md">
          <div className="abyssa-modal__head">
            {header ?? <h2 className="abyssa-modal__title">{title}</h2>}
          </div>
          <div className="abyssa-modal__body">{children}</div>
          {footer && <div className="abyssa-modal__foot">{footer}</div>}
        </RpgFrame>
      </div>
    </div>
  );
}
