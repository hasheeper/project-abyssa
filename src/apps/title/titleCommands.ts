/* 标题菜单的四项。焦点与存档决定当前强调项，命令定义不绑定视觉皮肤。 */

export type TitleCommandId = "continue" | "begin" | "archive" | "settings";

export interface TitleCommand {
  id: TitleCommandId;
  label: string;
  /** 未接入时显示的说明。 */
  pending: string;
}

export const TITLE_COMMANDS: readonly TitleCommand[] = [
  {
    id: "continue",
    label: "继续游戏",
    pending: "读取本机档案"
  },
  {
    id: "begin",
    label: "新的开始",
    pending: "创建新的独立档案"
  },
  {
    id: "archive",
    label: "记录",
    pending: "管理、导入和导出档案"
  },
  {
    id: "settings",
    label: "设定",
    pending: "设定界面尚未接入"
  }
];
