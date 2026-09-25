import slime from "../../assets/battle/tide-reef/enemy.slime.mire.png";
import blade from "../../assets/battle/tide-reef/enemy.outlaw.blade.png";
import crossbow from "../../assets/battle/tide-reef/enemy.outlaw.crossbow.png";
import hauler from "../../assets/battle/tide-reef/enemy.outlaw.hauler.png";
import chief from "../../assets/battle/tide-reef/enemy.outlaw.chief.png";
import crab from "../../assets/battle/tide-reef/enemy.beast.reef-crab.png";
import leech from "../../assets/battle/tide-reef/enemy.beast.shell-leech.png";
import shore from "../../assets/backgrounds/tide-reef/bg.tide-reef.shore.jpg";
import grotto from "../../assets/map/quest-backgrounds/tidecall-grotto.jpg";
import boardwalk from "../../assets/backgrounds/tide-reef/bg.tide-reef.boardwalk.jpg";

/** Asset identities and species names stay independent of encounter definitions. */
export const reefEnemyArt: Record<string, {url: string; height: number; baseName: string}> = {
  "enemy.slime.mire": {url: slime, height: 145, baseName: "浊泥史莱姆"},
  "enemy.outlaw.blade": {url: blade, height: 216, baseName: "亡命徒·刀手"},
  "enemy.outlaw.crossbow": {url: crossbow, height: 180, baseName: "亡命徒·弩手"},
  "enemy.outlaw.hauler": {url: hauler, height: 280, baseName: "亡命徒·扛夫"},
  "enemy.outlaw.chief": {url: chief, height: 266, baseName: "亡命头目"},
  "enemy.beast.reef-crab": {url: crab, height: 170, baseName: "硬壳礁蟹"},
  "enemy.beast.shell-leech": {url: leech, height: 210, baseName: "藏壳海蛭"},
};
export const reefScenes: Record<string, {background: string; location: string}> = {
  "scene.tide-reef.shore": {background: shore, location: "雾滩洞口"},
  "scene.tide-reef.grotto": {background: grotto, location: "洞内石阶"},
  "scene.tide-reef.boardwalk": {background: boardwalk, location: "走私栈道"},
};
