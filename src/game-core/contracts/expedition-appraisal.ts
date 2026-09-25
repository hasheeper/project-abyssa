import * as v from "./validation";

/** Economic prototypes remain Catalog loot. Qualities are program facts, not model output. */
export const CURIO_RARITIES: Readonly<Record<string, "bronze" | "silver">> = {
  "loot.salvage.ship-lamp-ring": "bronze",
  "loot.curio.navigation-compass": "silver",
  "loot.curio.napkin-clip": "silver",
  "loot.curio.clock-reed": "silver",
};
export const APPRAISAL_EMOTIONS = ["neutral", "smile", "wry", "confident", "confused", "surprised"] as const;
export const APPRAISAL_CAPACITY = 2;
export type AppraisalLine = {text: string; emotion: typeof APPRAISAL_EMOTIONS[number]};
export type AppraisalSlot = {
  key: string; instanceId: string; grantId: string; baseDefinitionId: string;
  roomId: string; roomDefinitionId: string; rarity: "bronze" | "silver";
  appraisalFee: number; salePrice: number; scrapPrice: number;
};
export type AppraisalCopy = {
  slotKey: string; unknownName: string; appearance: string; name: string; description: string;
  selectUnknown: AppraisalLine; selectKnown: AppraisalLine; appraisal: AppraisalLine[]; sold: AppraisalLine;
};
/** Only public fields enter unidentified item views or dungeon writing requests. */
export type PublicAppraisal = Pick<AppraisalCopy, "unknownName" | "appearance" | "selectUnknown"> &
  {identified: null | (Pick<AppraisalCopy, "name" | "description" | "selectKnown" | "appraisal" | "sold"> & {rarity: AppraisalSlot["rarity"]})};

export function parseAppraisalSlots(raw: unknown): AppraisalSlot[] {
  const slots = v.list(raw, "appraisalSlots", APPRAISAL_CAPACITY).map(raw => {
    const s = v.record(raw, "appraisalSlot", ["key", "instanceId", "grantId", "baseDefinitionId", "roomId", "roomDefinitionId", "rarity", "appraisalFee", "salePrice", "scrapPrice"]);
    const baseDefinitionId = v.id(s.baseDefinitionId, "appraisalSlot.baseDefinitionId"), rarity = v.choice(s.rarity, ["bronze", "silver"], "appraisalSlot.rarity");
    if (CURIO_RARITIES[baseDefinitionId] !== rarity) v.invalid("appraisalSlot", "Unknown economic prototype or mismatched rarity");
    return {key: v.id(s.key, "slot.key"), instanceId: v.id(s.instanceId, "instanceId"), grantId: v.id(s.grantId, "grantId"), baseDefinitionId,
      roomId: v.id(s.roomId, "roomId"), roomDefinitionId: v.id(s.roomDefinitionId, "roomDefinitionId"), rarity,
      appraisalFee: v.number(s.appraisalFee, "appraisalFee", 0, 50_000), salePrice: v.number(s.salePrice, "salePrice", 1, 1_000_000), scrapPrice: v.number(s.scrapPrice, "scrapPrice", 1, 1000)};
  });
  for (const key of ["key", "instanceId", "grantId"] as const) v.ids(slots.map(s => s[key]), `appraisalSlots.${key}`);
  return slots;
}
function chinese(raw: unknown, path: string, max: number) {
  const text = v.text(raw, path, max);
  if (!text.trim() || /[\u3040-\u30ff]/u.test(text) || !/[\u3400-\u9fff]/u.test(text)) v.invalid(path, "鉴定物内容必须为中文，不能包含日文台词。");
  if (/[{}<>]/u.test(text)) v.invalid(path, "商店小对话框只接受正文，不接受脚本、标签或未替换变量。");
  return text;
}
export function parseAppraisalItems(raw: unknown): AppraisalCopy[] {
  const line = (raw: unknown): AppraisalLine => {
    const r = v.record(raw, "appraisalLine", ["text", "emotion"]);
    return {text: chinese(r.text, "appraisalLine.text", 240), emotion: v.choice(r.emotion, APPRAISAL_EMOTIONS, "appraisalLine.emotion")};
  };
  const items = v.list(raw, "appraisalItems", APPRAISAL_CAPACITY).map(raw => {
    const r = v.record(raw, "appraisalCopy", ["slotKey", "unknownName", "appearance", "name", "description", "selectUnknown", "selectKnown", "appraisal", "sold"]);
    const appraisal = v.list(r.appraisal, "appraisal", 4).map(line);
    if (!appraisal.length) v.invalid("appraisal", "至少提供一句鉴定台词。");
    return {slotKey: v.id(r.slotKey, "slotKey"), unknownName: chinese(r.unknownName, "unknownName", 40), appearance: chinese(r.appearance, "appearance", 400),
      name: chinese(r.name, "name", 60), description: chinese(r.description, "description", 600),
      selectUnknown: line(r.selectUnknown), selectKnown: line(r.selectKnown), appraisal, sold: line(r.sold)};
  });
  v.ids(items.map(i => i.slotKey), "appraisalItems.slotKey");
  return items;
}
