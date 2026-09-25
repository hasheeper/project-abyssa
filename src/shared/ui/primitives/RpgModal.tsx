import type { ReactNode } from "react";
import { IconButton } from "./IconButton";
import { Nameplate } from "./Nameplate";
import { RpgFrame } from "./RpgFrame";
import type { RpgFrameProps } from "./RpgFrame";
import { UiModal, type UiModalProps } from "../motion/UiModal";

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
 * Motion 保留退出节点；焦点、输入隔离与归还跟随其真实呈现生命周期。
 * 调用方保持组件挂载并改变 open，不要在外层用 open && 卸载 presence 边界。
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
  /** 自定义头部,覆盖默认的标题行；null 不渲染框内头部。 */
  header?: ReactNode;
  /** 框外导航,仍在 dialog 内参与焦点循环。 */
  navigation?: ReactNode;
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
  /** Slim external plate for the manor utility windows; default artwork stays unchanged. */
  signboardVariant?: "default" | "slim";
  /** 是否渲染右上角关闭键,默认 true。 */
  closable?: boolean;
  frameVariant?: RpgFrameProps["variant"];
  className?: string;
  panelClassName?: string;
  /** 关闭后要把焦点还给谁。缺省则还给打开前的 activeElement。 */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** 与背景 inert／快捷键门禁同步，false 只在退出完成或宿主卸载后通知。 */
  onPresentChange?: (present: boolean) => void;
  motionPreset?: Exclude<UiModalProps["motionPreset"], "confirmation">;
}

export function RpgModal({ open, onClose, title, header, navigation, children, footer,
  signboard, signboardSecondary, signboardVariant = "default", closable = true,
  frameVariant = "dark", className, panelClassName, returnFocusRef, onPresentChange,
  dismissOnBackdrop, dismissOnEscape, motionPreset }: RpgModalProps) {
  return <UiModal open={open} onClose={onClose} title={title} className={className} panelClassName={panelClassName}
    returnFocusRef={returnFocusRef} onPresentChange={onPresentChange} dismissOnBackdrop={dismissOnBackdrop} dismissOnEscape={dismissOnEscape} motionPreset={motionPreset}>
    {present => <>{/* 名牌骑在面板上边缘。用 Nameplate 而不是 RpgHeader:
            RpgHeader 是 660x116 的横幅招牌,为整屏顶部设计,压到模态上必须
            缩到 .78 才放得下,字就糊了;而 Nameplate 本身就是"主名 + 罗马字
            副名"的六边形牌,尺寸量级和模态标题匹配,且它是全库通用的姓名牌。 */}
        {signboard && (
          <div className="abyssa-modal__signboard" data-variant={signboardVariant} aria-hidden="true">
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
            disabled={!present}
          />
        )}
        {navigation && <div className="abyssa-modal__navigation">{navigation}</div>}
        <RpgFrame variant={frameVariant} padding="md">
          {header !== null && <div className="abyssa-modal__head">
            {header ?? <h2 className="abyssa-modal__title">{title}</h2>}
          </div>}
          <div className="abyssa-modal__body">{children}</div>
          {footer && <div className="abyssa-modal__foot">{footer}</div>}
        </RpgFrame>
</>}
  </UiModal>;
}
