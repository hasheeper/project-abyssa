import dagger from "../../assets/icons/items/plain-dagger.svg";
import pouch from "../../assets/icons/items/medical-pack.svg";
import bracer from "../../assets/icons/items/bracer.svg";
import stone from "../../assets/icons/items/stone-pile.svg";
import needle from "../../assets/icons/items/sewing-needle.svg";
import strap from "../../assets/icons/items/leather-vest.svg";
import sleeve from "../../assets/icons/items/sacrificial-dagger.svg";
import bell from "../../assets/icons/items/ringing-bell.svg";

/** Uses the same Game-Icons silhouette library as supplies and loot. */
export const equipmentArt: Record<string, {name: string; icon: string; description: string}> = {
  "equipment.spare-blade": {name: "备用短刃", icon: dagger, description: "全部原生空面改为攻击 1"},
  "equipment.emergency-pouch": {name: "应急药囊", icon: pouch, description: "全部原生空面改为治疗 1"},
  "equipment.iron-bracer": {name: "嵌铁护腕", icon: bracer, description: "选择一个原生普通防御面，效力 +1"},
  "equipment.leather-bracer": {name: "软革护腕", icon: bracer, description: "全部原生空面改为防御 1"},
  "equipment.whetstone": {name: "磨刃石", icon: stone, description: "选择一个原生普通攻击面，效力 +1"},
  "equipment.watch-bell": {name: "守夜铜铃", icon: bell, description: "选择一个原生空面，改为防御 2"},
  "equipment.needle-case": {name: "药师针匣", icon: needle, description: "选择一个原生普通治疗面，效力 +1"},
  "equipment.mercenary-strap": {name: "佣兵肩带", icon: strap, description: "选择一个原生普通攻击面，改为防御 2"},
  "equipment.sleeve-blade": {name: "袖藏短刃", icon: sleeve, description: "选择一个原生普通防御面，改为攻击 2"},
};
