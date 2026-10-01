import { MANOR_SECTION_ICONS, manorIcon } from "../shared/ui/patterns/manor-icons";
import { useMoney } from "../shared/ui/primitives/Money";
import { useState } from "react";
import { supplyArt } from "../content/presentation/supply-icons";
import { ItemSlot, ItemSlotStatic } from "../shared/ui/primitives/ItemSlot";
import { RpgFacetDiamond } from "../shared/ui/primitives/RpgFacetDiamond";
import { ManorItemShowcase, ManorPanel, ManorQuantity, ManorStage, ManorStat, ManorStats } from "../shared/ui/patterns/ManorParts";
import { UiContentTransition } from "../shared/ui/motion/UiContentTransition";
import { CurrencyAmount } from "../shared/ui/primitives/CurrencyAmount";
import publicCoin from "../assets/icons/items/crown-coin.svg";
import shopIcon from "../assets/icons/items/two-coins.svg";
import equipmentIcon from "../assets/icons/items/bracer.svg";
import { JournalButton, JournalDockBar } from "./JournalPrimitives";
import { JournalLink } from "./CampaignJournal";
import { DEPARTURE_ITEM_LIMIT, type DepartureSupply } from "./useDepartureLoadout";
import "./departure-preparation.css";

function PreparationBalance({label, value, currency, iconUrl}: {label: string; value: number; currency: "gold" | "crystal"; iconUrl?: string}) {
  const money = useMoney();
  return <span className="departure-preparation__balance" data-currency={currency} role="img"
    aria-label={`${label} ${currency === "crystal" ? value.toLocaleString("en-US") : money.format(value)}`}>
    <small aria-hidden="true">{label}</small>
    <span aria-hidden="true"><CurrencyAmount value={value} currency={currency} iconUrl={iconUrl}/></span>
  </span>;
}

export function DeparturePreparation({items, selectedIds, onChange, lockedReason, storageUnavailable,
  funds, mapHref, equipmentHref, shopHref, itemLimit = DEPARTURE_ITEM_LIMIT, quantities, onQuantity}: {
  items: DepartureSupply[]; selectedIds: string[]; onChange: (ids: string[]) => void;
  lockedReason?: string; storageUnavailable?: boolean;
  itemLimit?: number; quantities?: Record<string, number>; onQuantity?: (id: string, quantity: number) => void;
  funds: {public:number; party:number; crystals:number}; mapHref:string; equipmentHref:string; shopHref:string;
}) {
  const [inspectedId, setInspectedId] = useState(selectedIds[0] ?? items[0]?.id);
  const inspected = items.find(item => item.id === inspectedId) ?? items[0];
  const carried = selectedIds.map(id => items.find(item => item.id === id)).filter((item): item is DepartureSupply => !!item);
  const included = !!inspected && selectedIds.includes(inspected.id);
  const carry = (item: DepartureSupply) => quantities?.[item.id] ?? item.availableCharges;
  const rejection = lockedReason || (!included && inspected && inspected.availableCharges < 1 ? "暂无库存，请先补充" : !included && carried.length >= itemLimit ? "行囊已满，请先移出一种" : "");
  const toggle = () => {
    if (!inspected || rejection) return;
    onChange(included ? selectedIds.filter(id => id !== inspected.id) : [...selectedIds,inspected.id]);
  };
  /* 与库存同一副骨架:左栏两块名牌面板(行囊在上、补给在下),右栏一块详情面板;
     窗口下沿是与日志同款的操作栏,左端余额,右端去处,主操作在最右。 */
  return <section className="departure-preparation" aria-label="出征补给整备" data-capacity={itemLimit}>
    <div className="departure-preparation__inventory">
      <ManorPanel className="departure-preparation__group" data-area="loadout" label="出征行囊" icon={manorIcon(MANOR_SECTION_ICONS.loadout)}
        aside={<span className="departure-preparation__capacity" aria-label={`已选 ${carried.length} 种，最多 ${itemLimit} 种`}><b>{carried.length}</b><i> / {itemLimit}</i></span>}>
        {/* 每个携带位立在一方展台上;空位同样占台,名称行写「空位」。 */}
        <ol className="departure-preparation__loadout" aria-label="出征携带位">
          {Array.from({length:itemLimit},(_,index) => {
            const item = carried[index];
            return <li key={index} data-empty={!item || undefined}>
              <ManorStage className="departure-preparation__berth">
                <div className="departure-preparation__item-art">
                  {item ? <ItemSlot icon={supplyArt[item.kind].icon} name={item.name} tone="interface" showRarity={false}
                    selected={inspected?.id === item.id} aria-label={`行囊第 ${index+1} 格：${item.name}`} aria-description={`出征携带 ${carry(item)} 份`}
                    onClick={() => setInspectedId(item.id)}/>
                    : <ItemSlotStatic tone="interface" showRarity={false}/>}
                  {item && <span className="abyssa-item-count departure-preparation__quantity" aria-hidden="true">{carry(item).toLocaleString("zh-CN")}</span>}
                </div>
              </ManorStage>
              <span className="departure-preparation__item-name" aria-hidden={!item || undefined}>{item?.name ?? "空位"}</span>
            </li>;
          })}
        </ol>
      </ManorPanel>
      <ManorPanel className="departure-preparation__group" data-area="catalogue" label="常备补给" icon={manorIcon(MANOR_SECTION_ICONS.provisions)}>
        <ul className="departure-preparation__catalogue" aria-label="可选补给">
          {items.map(item => <li key={item.id} data-stocked={item.availableCharges > 0} data-carried={selectedIds.includes(item.id)}>
            <div className="departure-preparation__item-art"><ItemSlot icon={supplyArt[item.kind].icon} name={item.name} tone="interface" showRarity={false}
              selected={inspected?.id === item.id} aria-label={`查看${item.name}详情`}
              aria-description={`库存 ${item.storedCharges} 份，${item.free ? `免费配给 ${item.availableCharges} 份` : item.availableCharges ? `可携带 ${item.availableCharges} 份` : "暂无库存，仍可查看用途"}${selectedIds.includes(item.id) ? "，已装入行囊" : ""}`}
              onClick={() => setInspectedId(item.id)}/>
              {selectedIds.includes(item.id) && <RpgFacetDiamond className="departure-preparation__carried" label="" state="current" role="img" aria-label="已装入"/>}
              <span className="abyssa-item-count departure-preparation__quantity" data-depleted={item.storedCharges === 0 || undefined} aria-hidden="true">{item.storedCharges.toLocaleString("zh-CN")}</span>
            </div>
          </li>)}
        </ul>
      </ManorPanel>
    </div>
    {/* 详情:展台 → 库存与携带 → 用途;装入或移出沉在面板底部,位置不随物品变化。 */}
    {inspected && <ManorPanel role="complementary" aria-label="补给详情" className="departure-preparation__detail" label={inspected.free ? "免费配给" : "战术补给"}>
      <UiContentTransition className="departure-preparation__sheet" contentKey={inspected.id}>
        <ManorItemShowcase icon={supplyArt[inspected.kind].icon} name={inspected.name} tag={included ? "已装入" : undefined}/>
        <ManorStats className="departure-preparation__stats">
          <ManorStat label="库存" value={inspected.storedCharges} unit="份"/>
          <ManorStat label="携带" value={carry(inspected)} unit="份" control={onQuantity && <ManorQuantity label={`${inspected.name}携带数量`}
            maximum={inspected.availableCharges} value={carry(inspected)} disabled={!!lockedReason || !inspected.availableCharges}
            onChange={value => onQuantity(inspected.id, value)}/>}/>
        </ManorStats>
        <p className="departure-preparation__effect">{supplyArt[inspected.kind].description}</p>
      </UiContentTransition>
      <div className="departure-preparation__detail-action">
        {rejection && <p role="status">{rejection}</p>}
        <JournalButton disabled={!!rejection} onClick={toggle}>{included ? "移出行囊" : "加入行囊"}</JournalButton>
      </div>
    </ManorPanel>}
    <div className="journal-dock departure-preparation__dock">
      <JournalDockBar label="整备操作" lead={<>
        <div className="departure-preparation__funds" data-testid="campaign-funds">
          <PreparationBalance label="公款" value={funds.public} currency="gold" iconUrl={publicCoin}/>
          <PreparationBalance label="小队资金" value={funds.party} currency="gold"/>
          <PreparationBalance label="晶石" value={funds.crystals} currency="crystal"/>
        </div>
        {storageUnavailable && <span className="departure-preparation__alert" role="alert">此窗口无法保留方案，请在出征编队重新确认。</span>}
      </>}>
        <a className="departure-preparation__aux-link" href={shopHref}><i aria-hidden="true" style={{maskImage: `url("${shopIcon}")`, WebkitMaskImage: `url("${shopIcon}")`}}/>补充物资</a>
        <a className="departure-preparation__aux-link" href={equipmentHref}><i aria-hidden="true" style={{maskImage: `url("${equipmentIcon}")`, WebkitMaskImage: `url("${equipmentIcon}")`}}/>查看骰装</a>
        <JournalLink href={mapHref} label="出征编队" emphasis="primary"/>
      </JournalDockBar>
    </div>
  </section>;
}
