import type { AuthoredLine } from "./authored-story";
import background from "../../assets/backgrounds/shop-bg3.jpg";

/** Placeholder beats for the first visit. Replace the staging/copy here; changing
 * the persisted cursor count requires a new content version. No generated story. */
export const shopIntroduction = {
  id: "story.shop.first-visit",
  title: "柜台后的招呼",
  location: "守望者杂货铺",
  background,
  lines: [
    {id: "shop.first-visit.0", characterId: "tibby", emotion: "smile", text: "哎呀，领主大人终于来光顾啦。欢迎来到守望者杂货铺，我是缇比。先别急着掏钱，认认柜台吧。"},
    {id: "shop.first-visit.1", characterId: "tibby", emotion: "wry", text: "浅滩那辆被掀翻的马车，是我的。那笔账嘛……等你有空，我们再慢慢聊。生意总得先做下去，对吧？"},
    {id: "shop.first-visit.2", characterId: "tibby", emotion: "confident", text: "缺出征用的道具，就看「购买」；想把带回来的东西换成银币，就看「出售」。挑中条目，看看数量和价钱，再决定。"},
    {id: "shop.first-visit.3", characterId: "tibby", emotion: "smile", text: "至于那些看不出名堂的怪东西，拿来「鉴定」。付点鉴定费，我替你认认来头；认清以后，留着还是卖掉，都随你。浅滩带回来的收获，也可以先让我瞧瞧～"},
  ] satisfies AuthoredLine[],
};

/** Same four persisted cursors; new content supplies its own first-item offer. */
export const copperShopIntroduction = {...shopIntroduction, lines: shopIntroduction.lines.map((line, index) => index === 3 ? {
  ...line, text: "那根发黑的钉子，放到「鉴定」这边。头回光顾，这件我免费替你看看。以后认怪东西，通常三枚银币；认清了，留着还是卖掉，都随你～",
} : line)};
