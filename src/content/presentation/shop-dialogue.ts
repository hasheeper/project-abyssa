import type { EmotionId } from "../../shared/domain/presentation/emotion";

/** Authored speech uses the same semantic expression cues as AVG. */
export type ShopDialogueLine = { text: string; emotion: EmotionId };

export const shopDialogue = {
  buy: {text: "想补些什么？食物和治疗药水，洋馆已经替你备好啦。", emotion: "smile"},
  sell: {text: "想出手什么？挑一件，我替你算算价钱。", emotion: "confident"},
  appraise: {text: "有看不懂的东西，就带来吧～可别把该还给别人的也摆上柜台呢。", emotion: "wry"},
  equipmentPurchased: {text: "收好啦～出发前记得试装，合手才好用哦。", emotion: "joy"},
  purchased: {text: "收好啦～出发前记得装进行囊，没用完的，下次还能带走哦。", emotion: "joy"},
} satisfies Record<string, ShopDialogueLine>;
