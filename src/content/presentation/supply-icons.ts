import bread from "../../assets/icons/items/sliced-bread.svg";
import potion from "../../assets/icons/items/health-potion.svg";
import ward from "../../assets/icons/items/crystal-earrings.svg";
import water from "../../assets/icons/items/water-flask.svg";
import tools from "../../assets/icons/items/monkey-wrench.svg";
import charm from "../../assets/icons/items/star-key.svg";
import slip from "../../assets/icons/items/tied-scroll.svg";

export const supplyArt: Record<string, {icon:string; description:string}> = {
  food: {icon:bread, description:"恢复 1 点生命"},
  potion: {icon:potion, description:"恢复 2 点生命"},
  ward: {icon:ward, description:"抵挡 2 点攻击伤害"},
  "holy-water": {icon:water, description:"解除骰子封印"},
  "maintenance-kit": {icon:tools, description:"清除一面临时锈蚀"},
  "lucky-charm": {icon:charm, description:"增加一次重掷"},
  "divination-slip": {icon:slip, description:"查阅事件或下一层"},
};
