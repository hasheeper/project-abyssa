import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { DEFAULT_ITEM_RARITY, type ItemRarity } from "../../shared/ui/items/rarity";
import type { Mode } from "./stock-model";

type DetailItem = {name: string; icon: string; description: string; owned: number; capacity?: number; delivery?: "supply" | "equipment"; remaining?: number | null; preview?: import("../../game-runtime/equipment-view").EquipmentPreview; lotSize?: number; priceLabel?: string; rarity?: ItemRarity};

/** The original counter's frame, item slot, title recess and quantity well.
 * Buying and selling use one composition; appraisal replaces only the checkout.
 */
export function TradeDetail({item, mode, quantity, maximum, total, action, disabled, appraising, identified, saleValue,
  onQuantity, onAction, busy = false, error, secondaryActions, actionLabel, bundleTotal = 0, onPreview, normalAppraisalFee, appraisalReason}: {
  item?: DetailItem; mode: Mode; quantity: number; maximum: number; total: number; action: string;
  disabled: boolean; appraising: boolean; identified: boolean; saleValue?: number;
  onQuantity: (quantity: number) => void; onAction: () => void;
  busy?: boolean; error?: string | null; secondaryActions?: ReactNode; actionLabel?: string;
  bundleTotal?: number; onPreview?: () => void;
  normalAppraisalFee?: number; appraisalReason?: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (appraising && !disabled) actionRef.current?.focus({preventScroll: true});
  }, [appraising, disabled]);
  const equipment = item?.delivery === "equipment";
  const trading = mode !== "appraise";
  const full = mode === "buy" && maximum === 0;
  const after = item ? item.owned + (mode === "buy" ? quantity : -quantity * (item.lotSize ?? 1)) : 0;
  const note = appraising ? "点击继续补全台词，再次点击听下一句；听完后可以收好。"
    : identified ? "这件物品已鉴定，可以保留，也可以交给缇比回收。"
    : full ? equipment ? "这件装备的商店份额已售罄。" : "这份补给已经备足，无需重复购买。"
    : action === "银钱不足" ? "银钱不足，请减少数量或出售已鉴定的物品。"
    : mode === "sell" ? "出售所选物品，款项计入小队资金。"
    : mode === "appraise" ? "支付一次鉴定费，听缇比介绍物品的来历与回收价。"
    : equipment ? "购买后存入馆内库存；请在角色页面配装，每人一个通用槽。" : "每份补充 1 次充能 · 出征前请将物资加入行囊。";
  return <RpgFrame className="new-shop-detail-frame" padding="none" watermark={false}>
    <section className="new-shop-detail" id="new-shop-detail" aria-label="物品详情">
      {error && <p className="new-shop-detail__error" role="alert">{error}</p>}
      {item ? <>
        <div className="new-shop-detail__description">
          <div className="new-shop-detail__emblem">
            <ItemSlotStatic className="new-shop-detail__slot" icon={item.icon} name={item.name} rarity={item.rarity ?? DEFAULT_ITEM_RARITY} showRarity={false} size={78} />
          </div>
          <div className="new-shop-detail__copy">
            <div className="new-shop-detail__heading">
              <h2>{item.name}</h2>
              <div className="new-shop-detail__capacity" role="group" aria-label="库存预览">
                <span>持有</span><b>{item.owned}{mode === "buy" && item.capacity !== undefined && ` / ${item.capacity}`}</b>
                {full ? <span className="new-shop-detail__full">{equipment ? "售罄" : "已备足"}</span> : trading && !item.priceLabel && <>
                  <span className="new-shop-detail__arrow" aria-hidden="true">→</span>
                  <output aria-label={mode === "buy" ? "购买后库存" : "出售后库存"}>{after}{mode === "buy" && item.capacity !== undefined && ` / ${item.capacity}`}</output>
                </>}
              </div>
            </div>
            <p>{item.description}</p>
            {equipment && <button type="button" className="new-shop-detail__preview" onClick={onPreview}>配装预览 · 余 {item.remaining}</button>}
          </div>
        </div>
        <div className="new-shop-detail__checkout">
          {trading ? <div className="new-shop-detail__quantity" role="group" aria-label="交易数量">
            <span>{(item.lotSize ?? 1) > 1 ? `整批 · ${item.lotSize}枚` : "数量"}</span><div>
              <IconButton label="减少数量" icon="minus" size="sm" variant="dark" disabled={busy || quantity <= 1} onClick={() => onQuantity(Math.max(1, quantity - 1))} />
              <output aria-label="交易数量">{quantity}</output>
              <IconButton label="增加数量" icon="plus" size="sm" variant="teal" disabled={busy || quantity >= maximum} onClick={() => onQuantity(quantity + 1)} />
            </div>
          </div> : <span className="new-shop-detail__appraisal-status">{appraising ? "缇比正在端详这件东西……" : identified ? "已鉴定" : total === 0 ? "本次免费" : "未鉴定"}</span>}
          <div className="new-shop-detail__total"><span>{mode === "sell" ? "收入" : mode === "appraise" ? identified ? "回收价" : "鉴定费" : "合计"}</span>
            {mode === "appraise" && !identified && normalAppraisalFee !== undefined && normalAppraisalFee > total && <del aria-label={`常规鉴定费 ${normalAppraisalFee} G`}>{normalAppraisalFee} G</del>}
            {item.priceLabel ? <span>{item.priceLabel}</span> : <CurrencyAmount value={identified ? saleValue ?? 0 : total} />}
            {mode === "appraise" && !identified && appraisalReason && <small>{appraisalReason}</small>}
            {bundleTotal > 0 && <small>含随附废料 <CurrencyAmount value={bundleTotal} /></small>}
          </div>
          <div className="new-shop-detail__purchase">
            {secondaryActions}
            <RpgNotchedPillButton ref={actionRef} className="new-shop__action" label={action} disabled={disabled} aria-label={actionLabel ?? action}
              aria-describedby={helpOpen ? helpId : undefined} onClick={onAction} />
            <div className="new-shop-detail__help" onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}
              onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);}}
              onKeyDown={event => {if (event.key === "Escape") setHelpOpen(false);}}>
              <button type="button" aria-label={`查看${mode === "buy" ? "购买" : mode === "sell" ? "出售" : "鉴定"}说明`}
                aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(current => !current)}>?</button>
              <p id={helpId} role="status" hidden={!helpOpen}>{note}</p>
            </div>
          </div>
        </div>
      </> : <p className="new-shop-detail__empty">选一件物品，放到柜台上。</p>}
    </section>
  </RpgFrame>;
}
