import { useState } from "react";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { ItemSlot, ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { MapCommand } from "./MapCommand";

export interface MapLoadoutItem {
  id: string;
  name: string;
  icon?: string;
  description: string;
  quantity: number;
  stock?: number;
  source: string;
  selected: boolean;
  blocked?: string;
}

export function MapLoadoutPanel({ items, limit, notice, onToggle, onClose }: {
  items: MapLoadoutItem[]; limit: number; notice?: string;
  onToggle: (id: string) => void; onClose: () => void;
}) {
  const [inspectedId, inspect] = useState(items.find(item => item.selected)?.id ?? items[0]?.id);
  const inspected = items.find(item => item.id === inspectedId) ?? items[0];
  const carried = items.filter(item => item.selected);
  return <RpgFrame className="map-supplies" variant="dark" padding="none" role="region" aria-label="出征行囊">
    <header className="map-supplies__heading"><div><span>DEPARTURE SUPPLIES</span><h2>出征行囊</h2></div>
      <p>已携带 <b>{carried.length}</b> / {limit} 种</p>
      <IconButton icon="close" label="关闭出征行囊" size="sm" onClick={onClose}/>
    </header>
    <div className="map-supplies__body">
      <div className="map-supplies__inventory">
        <section aria-label="已携带补给"><h3>携带位 <small>出发时按此方案装入</small></h3>
          <ol className="map-supplies__carried">{Array.from({ length: Math.max(limit, carried.length) }, (_, index) => {
            const item = carried[index];
            return <li key={index}>
              {item ? <ItemSlot icon={item.icon} name={item.name} quantity={item.quantity} size={76} tone="interface" showRarity={false}
                selected={item.id === inspected?.id} aria-label={`携带位 ${index + 1}：${item.name}`} onClick={() => inspect(item.id)}/>
                : <ItemSlotStatic size={76} tone="interface" showRarity={false}/>}
              <span>{item?.name ?? "空位"}</span>
            </li>;
          })}</ol>
        </section>
        <section aria-label="可选补给"><h3>常备补给 <small>选中查看用途与库存</small></h3>
          <ul className="map-supplies__catalogue">{items.map(item => <li key={item.id} data-carried={item.selected} data-empty={item.quantity === 0}>
            <ItemSlot icon={item.icon} name={item.name} size={64} tone="interface" showRarity={false}
              selected={item.id === inspected?.id} aria-label={`查看补给：${item.name}`} onClick={() => inspect(item.id)}/>
            <span className="map-supplies__stock">{item.stock ?? item.quantity}</span>
            <span className="map-supplies__check" aria-label={item.selected ? "已携带" : undefined}>{item.selected ? "◆" : ""}</span>
            <span className="map-supplies__name">{item.name}</span>
          </li>)}</ul>
        </section>
      </div>
      {inspected ? <aside className="map-supplies__detail" aria-label="补给详情">
        <div className="map-supplies__identity"><ItemSlotStatic icon={inspected.icon} name={inspected.name} size={86} tone="interface" showRarity={false}/>
          <div><span>{inspected.source}</span><h3>{inspected.name}</h3></div></div>
        <p>{inspected.description}</p>
        <dl><div><dt>现有库存</dt><dd>{inspected.stock ?? inspected.quantity}</dd></div><div><dt>出征携带</dt><dd>{inspected.quantity}</dd></div></dl>
        <p className="map-supplies__reason" role="status">{inspected.blocked ?? (inspected.selected ? "已装入行囊" : "尚未携带")}</p>
        <MapCommand className="map-supplies__toggle" disabled={!!inspected.blocked} onClick={() => onToggle(inspected.id)}>
          {inspected.selected ? "移出行囊" : "加入行囊"}
        </MapCommand>
      </aside> : <p>营地暂无物品，可以空包出征。</p>}
    </div>
    <footer className="map-supplies__footer"><p>{notice ?? "食物与药水出发时补足；战术补给使用现有库存。"}</p>
      <MapCommand className="map-supplies__done" onClick={onClose}>完成整备</MapCommand></footer>
  </RpgFrame>;
}
