import type { AbyssaVariant } from "../../shared/ui/types";

/* 标题菜单的四项。跨页导航一律是同源相对 URL —— 仓库没有 Router,
   页面之间靠 shared/transition 的黑幕接力(sessionStorage 交接)。 */

export type TitleCommandId = "continue" | "begin" | "archive" | "settings";

export interface TitleCommand {
  id: TitleCommandId;
  label: string;
  variant: AbyssaVariant;
  /** 未接入时显示的说明。 */
  pending: string;
}

export const TITLE_COMMANDS: readonly TitleCommand[] = [
  {
    id: "continue",
    label: "继续游戏",
    variant: "dark",
    pending: "读取本机档案"
  },
  {
    // 唯一的强调项:用 teal(在 title.css 里被本地重映射为 logo 的金色)。
    id: "begin",
    label: "新的开始",
    variant: "teal",
    pending: "创建新的独立档案"
  },
  {
    id: "archive",
    label: "记录",
    variant: "dark",
    pending: "管理、导入和导出档案"
  },
  {
    id: "settings",
    label: "设定",
    variant: "dark",
    pending: "设定界面尚未接入"
  }
];
