// Browser-only presentation fixture. It never reads or writes a game save.
import { createRoot } from "react-dom/client";
import { Stage } from "../../../src/shared/stage/Stage";
import { AbyssaProvider } from "../../../src/shared/ui/primitives/AbyssaProvider";
import { ResourceInventoryDialog } from "../../../src/shared/ui/patterns/ResourceInventoryDialog";
import bread from "../../../src/assets/icons/items/sliced-bread.svg";
import potion from "../../../src/assets/icons/items/health-potion.svg";
import bag from "../../../src/assets/icons/items/swap-bag.svg";
import "../../../src/shared/ui/styles/tokens.css";
import "../../../src/shared/ui/styles/components-core.css";
import "../../../src/shared/ui/styles/items.css";
import "../../../src/shared/ui/styles/manor-utility.css";
import "../../../src/shared/stage/stage.css";

// The smoke-test bundle uses base64 SVGs so quoted CSS mask URLs stay valid.
const iconUrl = (data: string) => `data:image/svg+xml;base64,${data}`;

const fixedEntries = ["食物", "药水", "护符", "圣水", "保养工具", "幸运符", "卦签"].map((name, index) => ({
  id: `fixed-${index}`, name, icon: iconUrl(index ? potion : bread), quantity: index < 2 ? index + 3 : 0, unit: "份", type: "常备补给", description: "测试补给效果",
}));
const entries = Array.from({length: 31}, (_, index) => ({
  id: `sandbox-${index}`, name: index === 1 ? "一件名字很长的叙事纪念物" : `叙事物品${index + 1}`,
  icon: iconUrl(bag), quantity: index === 2 ? 12345 : index + 1, unit: "件",
  rarity: ["bronze", "silver", "gold", "amethyst", "mythic"][index % 5],
  status: index === 1 ? "待交付" : undefined,
  description: "来自已确认获得的物品记录。",
}));

const root = createRoot(document.getElementById("root")!);
function renderInventory(count: number) {
  root.render(
    <AbyssaProvider><Stage style={{height: "100vh"}} background="#101616">
      <ResourceInventoryDialog open onClose={() => {}} className="manor-utility" fixedEntries={fixedEntries} entries={entries.slice(0, count)}/>
    </Stage></AbyssaProvider>,
  );
}
// Compare empty, partial and full inventories without touching game state.
window.addEventListener("resource-inventory-fixture-count", event => renderInventory((event as CustomEvent<number>).detail));
renderInventory(entries.length);
