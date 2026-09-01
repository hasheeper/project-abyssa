import type { HTMLAttributes, ReactNode } from "react";
import type { RpActor, RpMessage } from "../rp-stage";

export type RpCrop = "full" | "upper" | "knee";
export type RpMode = "play" | "log";

export interface RpSceneProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  actors: RpActor[];
  messages: RpMessage[];
  /** 背景图 url。 */
  background?: string;
  /**
   * 立绘取景距离,默认 knee(中距离,切在膝下)。
   *   knee   中距离 —— 默认。去掉脚与小腿,人物占框更满
   *   upper  近距离 —— 切在大腿中部,更贴脸
   *   full   全身   —— 完整画布,人物会显得很小
   * 切口靠框底的预留(--abyssa-rp-doll-bleed)藏在框外。
   */
  crop?: RpCrop;
  /** 日志顶部插槽(章节标题、连接状态等)。 */
  header?: ReactNode;
  /**
   * 呈现模式,默认 play(演绎)。
   * play 将最后一条对白作为当前发言；log 将全部消息按历史形态展示。
   */
  mode?: RpMode;
  /** 挂载时已在场的消息是否跳过入场演出。 */
  hydrate?: boolean;
}
