import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../shared/lib/cx";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import { MapMetalCorners, MapWoodRails } from "./MapWoodFrame";

/* ============ 作战桌文书 ============
 *
 * 摆在作战桌上的一份文书，装在地图画框的缩小版里：同一套木轨、黄铜带与
 * 金属角件（MapWoodFrame），框内上格是纸、下格是木台。
 *   纸   —— 正文（children）。纸裁自地图本身的羊皮纸，字是手写楷体；
 *   木台 —— 工具（ledge）：人、物与主按钮。
 * 顶轨正中骑一块单行名牌。委托书与出战名单的资料页都是这一份文书，
 * 各自只排自己的版心，不再各画一遍框。 */

export interface MapDocumentProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "aside" | "section" | "div";
  /** 顶轨名牌上的单行标题。 */
  title: string;
  /** 木台上的工具与主按钮；没有就只有一张纸。 */
  ledge?: ReactNode;
  /** 给了 onClose 才在右上角钉一枚关闭钮。 */
  closeLabel?: string;
  onClose?: () => void;
}

export function MapDocument({
  as: Element = "section", title, ledge, closeLabel = "关闭", onClose, className, children, ...rest
}: MapDocumentProps) {
  return (
    <Element className={cx("abyssa-map-document", className)} {...rest}>
      <MapWoodRails />
      <div className="abyssa-map-wood-frame__brass abyssa-map-document__brass">
        <div className="abyssa-map-document__paper">{children}</div>
        {ledge && <footer className="abyssa-map-document__ledge">{ledge}</footer>}
        <MapMetalCorners className="abyssa-map-document__corners" />
      </div>

      {/* 名牌骑在顶轨正中，只写一行 —— 与地图上的地标名牌、顶部地名牌同一种单行铭牌。 */}
      <header className="abyssa-map-document__head">
        <Nameplate className="abyssa-map-document__plate" role="heading" aria-level={2} name={title} watermark={false} />
      </header>
      {onClose && <IconButton className="abyssa-map-document__close" label={closeLabel} icon="close" size="sm" onClick={onClose} />}
    </Element>
  );
}
