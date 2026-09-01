import type { AbyssaVariant } from "../../shared/ui/types";

/* 标题菜单的四项。跨页导航一律是同源相对 URL —— 仓库没有 Router,
   页面之间靠 shared/transition 的黑幕接力(sessionStorage 交接)。 */

export type TitleCommandId = "continue" | "begin" | "archive" | "settings";

interface TitleCommandTarget {
  href: string;
  /** 黑幕上显示的目标场景名。 */
  destination: string;
  /** 很短的系统分区名。 */
  channel: string;
}

export interface TitleCommand {
  id: TitleCommandId;
  label: string;
  variant: AbyssaVariant;
  /** 缺省表示该入口尚未接入,此时只提示不跳转。 */
  target?: TitleCommandTarget;
  /** 未接入时显示的说明。 */
  pending: string;
}

export const TITLE_COMMANDS: readonly TitleCommand[] = [
  {
    id: "continue",
    label: "继续游戏",
    variant: "dark",
    target: { href: "./menu.html", destination: "守望者之崖", channel: "正在载入" },
    pending: "存档系统尚未接入"
  },
  {
    // 唯一的强调项:用 teal(在 title.css 里被本地重映射为 logo 的金色)。
    id: "begin",
    label: "新的开始",
    variant: "teal",
    target: { href: "./menu.html", destination: "守望者之崖", channel: "正在开启" },
    pending: "开场流程尚未接入"
  },
  {
    id: "archive",
    label: "记录",
    variant: "dark",
    pending: "记录界面尚未接入"
  },
  {
    id: "settings",
    label: "设定",
    variant: "dark",
    pending: "设定界面尚未接入"
  }
];
