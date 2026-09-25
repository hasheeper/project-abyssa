import { QuantityStepper } from "../shared/ui/primitives/QuantityStepper";
import { useMoney } from "../shared/ui/primitives/Money";
import { useState } from "react";
import { supplyArt } from "../content/presentation/supply-icons";
import { ItemSlot, ItemSlotStatic } from "../shared/ui/primitives/ItemSlot";
import { CurrencyAmount } from "../shared/ui/primitives/CurrencyAmount";
import publicCoin from "../assets/icons/items/crown-coin.svg";
import shopIcon from "../assets/icons/items/two-coins.svg";
import equipmentIcon from "../assets/icons/items/bracer.svg";
import { JournalButton } from "./JournalPrimitives";
import { JournalLink } from "./CampaignJournal";
import { DEPARTURE_ITEM_LIMIT, type DepartureSupply } from "./useDepartureLoadout";
import "./departure-preparation.css";

function PreparationBalance({label, value, currency, iconUrl}: {label: string; value: number; currency: "gold" | "crystal"; iconUrl?: string}) {
  const money = useMoney();
  return <span className="departure-preparation__balance" data-currency={currency} role="img"
    aria-label={`${label} ${currency === "crystal" ? value.toLocaleString("en-US") : money.format(value)}`} tabIndex={0}>
    <span aria-hidden="true"><CurrencyAmount value={value} currency={currency} iconUrl={iconUrl}/></span>
    <span className="departure-preparation__balance-hint" aria-hidden="true">{label}</span>
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
  const rejection = lockedReason || (!included && inspected && inspected.availableCharges < 1 ? "暂无库存，请先补充" : !included && carried.length >= itemLimit ? "行囊已满，请先移出一种" : "");
  const toggle = () => {
    if (!inspected || rejection) return;
    onChange(included ? selectedIds.filter(id => id !== inspected.id) : [...selectedIds,inspected.id]);
  };
  return <section className="departure-preparation" aria-label="出征补给整备" data-capacity={itemLimit}>
    <div className="departure-preparation__main">
      <div className="departure-preparation__inventory manor-utility__inset">
        <section className="departure-preparation__group" role="group" aria-label="行囊装配区">
        <header className="departure-preparation__heading"><h3>出征行囊</h3><span className="departure-preparation__rule" aria-hidden="true"/><span className="departure-preparation__capacity" aria-label={`已选 ${carried.length} 种，最多 ${itemLimit} 种`}><b>{carried.length}</b><i> / {itemLimit}</i></span></header>
        <ol className="departure-preparation__loadout" aria-label="出征携带位">
          {Array.from({length:itemLimit},(_,index) => {
            const item = carried[index];
            return <li key={index} data-empty={!item || undefined}>
              <div className="departure-preparation__item-art">
                {item ? <ItemSlot icon={supplyArt[item.kind].icon} name={item.name} size={108} tone="interface" showRarity={false}
                  selected={inspected?.id === item.id} aria-label={`行囊第 ${index+1} 格：${item.name}`} aria-description={`出征携带 ${quantities?.[item.id] ?? item.availableCharges} 份`}
                  onClick={() => setInspectedId(item.id)}/>
                  : <ItemSlotStatic size={108} tone="interface" showRarity={false}/>}
                {item && <span className="abyssa-item-count departure-preparation__quantity" aria-hidden="true">{(quantities?.[item.id] ?? item.availableCharges).toLocaleString("zh-CN")}</span>}
              </div>
              <span className="departure-preparation__item-name" aria-hidden={!item || undefined}>{item?.name}</span>
            </li>;
          })}
        </ol>
        </section>
        <section className="departure-preparation__group" aria-label="补给库">
        <header className="departure-preparation__heading"><h3>常备补给</h3><span className="departure-preparation__rule" aria-hidden="true"/></header>
        <ul className="departure-preparation__catalogue" aria-label="可选补给">
          {items.map(item => <li key={item.id} data-stocked={item.availableCharges > 0} data-carried={selectedIds.includes(item.id)}>
            <div className="departure-preparation__item-art"><ItemSlot icon={supplyArt[item.kind].icon} name={item.name} size={80} tone="interface" showRarity={false}
              selected={inspected?.id === item.id} aria-label={`查看${item.name}详情`}
              aria-description={`库存 ${item.storedCharges} 份，${item.free ? `免费配给 ${item.availableCharges} 份` : item.availableCharges ? `可携带 ${item.availableCharges} 份` : "暂无库存，仍可查看用途"}${selectedIds.includes(item.id) ? "，已装入行囊" : ""}`}
              onClick={() => setInspectedId(item.id)}/>
              {selectedIds.includes(item.id) && <span className="departure-preparation__carried" aria-label="已装入">✓</span>}
              <span className="abyssa-item-count departure-preparation__quantity" data-depleted={item.storedCharges === 0 || undefined} aria-hidden="true">{item.storedCharges.toLocaleString("zh-CN")}</span>
            </div>
          </li>)}
        </ul>
        </section>
      </div>
      {inspected && <aside className="departure-preparation__detail" aria-label="补给详情">
        <header className="departure-preparation__detail-identity"><ItemSlotStatic icon={supplyArt[inspected.kind].icon} name={inspected.name} size={96} tone="interface" showRarity={false}/><div><span className="departure-preparation__kind">{inspected.free ? "免费配给" : "战术补给"}</span><h3>{inspected.name}</h3></div></header>
        <p className="departure-preparation__effect">{supplyArt[inspected.kind].description}</p>
        <dl><div><dt>当前库存</dt><dd>{inspected.storedCharges} <small>份</small></dd></div><div><dt>出征携带</dt><dd>{quantities?.[inspected.id] ?? inspected.availableCharges} <small>份</small></dd></div></dl>
        {onQuantity && <QuantityStepper label={`${inspected.name}携带数量`} maximum={inspected.availableCharges} value={quantities?.[inspected.id] ?? inspected.availableCharges} disabled={!!lockedReason || !inspected.availableCharges} onChange={value => onQuantity(inspected.id, value)}/>}
        <div className="departure-preparation__detail-action">
          <p role={rejection ? "status" : undefined} aria-hidden={!rejection || undefined}>{rejection}</p>
          <JournalButton disabled={!!rejection} onClick={toggle}>{included ? "移出行囊" : "加入行囊"}</JournalButton>
        </div>
      </aside>}
    </div>
    <footer className="departure-preparation__footer">
      <div><div className="departure-preparation__funds" data-testid="campaign-funds">
        <PreparationBalance label="公款" value={funds.public} currency="gold" iconUrl={publicCoin}/>
        <PreparationBalance label="小队资金" value={funds.party} currency="gold"/>
        <PreparationBalance label="晶石" value={funds.crystals} currency="crystal"/>
      </div>{storageUnavailable && <span role="alert">此窗口无法保留方案，请在出征编队重新确认。</span>}</div>
      <nav aria-label="整备操作">
        <a className="departure-preparation__aux-link" href={shopHref}><i aria-hidden="true" style={{maskImage: `url("${shopIcon}")`, WebkitMaskImage: `url("${shopIcon}")`}}/>补充物资</a>
        <a className="departure-preparation__aux-link" href={equipmentHref}><i aria-hidden="true" style={{maskImage: `url("${equipmentIcon}")`, WebkitMaskImage: `url("${equipmentIcon}")`}}/>查看骰装</a>
        <JournalLink href={mapHref} label="出征编队" emphasis="primary"/>
      </nav>
    </footer>
  </section>;
}
