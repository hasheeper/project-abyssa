import abyssaAvatar from "../assets/avatar/abyssa.png";
import eloraAvatar from "../assets/avatar/elora.png";
import eusticeAvatar from "../assets/avatar/eustice.png";
import lenoreAvatar from "../assets/avatar/lenore.png";
import type { RpActor, RpMessage } from "../components/RpScene";

/** 四人名册,但舞台只有两栏——蕾诺尔中途插入时会顶掉更久未发言的一侧。
    name 上气泡标签,fullName / secondaryName 上席位名牌;取值对齐 demo/data.ts 的角色档案。 */
export const ACTORS: RpActor[] = [
  {
    id: "abyssa",
    name: "艾比希斯",
    fullName: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    avatar: abyssaAvatar,
    accent: "#8fd0d4"
  },
  {
    id: "elora",
    name: "艾洛拉",
    fullName: "艾洛拉·亚金特",
    secondaryName: "ELORA ARGENT",
    avatar: eloraAvatar,
    accent: "#c9a3d8"
  },
  {
    id: "eustice",
    name: "尤斯缇丝",
    fullName: "尤斯缇丝·格里芬",
    secondaryName: "EUSTICE GRIFFIN",
    avatar: eusticeAvatar,
    accent: "#d4b96a"
  },
  {
    id: "lenore",
    name: "蕾诺尔",
    fullName: "蕾诺尔·伏尼契",
    secondaryName: "LENORE VOYNICH",
    avatar: lenoreAvatar,
    accent: "#ce7772"
  }
];

export const TRANSCRIPT: RpMessage[] = [
  { id: "m01", kind: "chapter", text: "第七日 · 月末的长桌" },
  {
    id: "m02",
    kind: "narration",
    text: "海风撞在洋馆的落地窗上,把咸味留在玻璃外面。餐厅的长桌被夕照切成两半,一半摊着账簿与收据,另一半堆着尚未拆封的补给箱。"
  },
  {
    id: "m03",
    kind: "say",
    actorId: "elora",
    expression: "a",
    text: "这个月的结余,是三百四十七枚铜板。……如果不算薇薇安小姐订的那批陈酿,本来应该还有两千的。"
  },
  {
    id: "m04",
    kind: "say",
    actorId: "eustice",
    expression: "k",
    text: "两千?哼,把整座酒窖填满也不需要两千。本小姐早就说过,那份订单必须先过我这道手续——规矩订下来是给人看的吗?"
  },
  {
    id: "m05",
    kind: "narration",
    text: "话音未落,长桌下的阴影里探出一段黑色的、果冻般的东西,不轻不重地戳了戳艾洛拉的手背。紧接着,银白的长发从桌沿缓慢地浮了上来。"
  },
  {
    id: "m06",
    kind: "say",
    actorId: "abyssa",
    expression: "star-eyes",
    text: "……布丁。"
  },
  {
    id: "m07",
    kind: "say",
    actorId: "eustice",
    expression: "j",
    text: "——谁允许你从桌子底下钻出来的!这里在议事,不是……(她清了清嗓子,把音量硬压下去)……总之,预算已经见底了。"
  },
  {
    id: "m08",
    kind: "say",
    actorId: "abyssa",
    expression: "a",
    text: "……嗯。(她盯着尤斯缇丝,眼神没有焦点,也没有移开)"
  },
  {
    id: "m09",
    kind: "roll",
    label: "议价检定 · 艾洛拉",
    formula: "1d20+6",
    detail: "[15] + 6",
    total: 21,
    outcome: "success"
  },
  {
    id: "m10",
    kind: "say",
    actorId: "elora",
    expression: "c",
    text: "那个,其实……集市的老板先生今天眼圈很黑,我顺手替他做了个清心祈祷,鸡蛋和牛乳就按上个月的价卖给我了!所以——布丁是做得出来的哦。"
  },
  {
    id: "m11",
    kind: "narration",
    text: "走廊尽头的阴影微微起伏。一顶压得很低的黑贝雷帽贴着墙角缓慢平移过来,停在光影交界的位置,再往前半步也没有。"
  },
  {
    id: "m12",
    kind: "say",
    actorId: "lenore",
    expression: "k",
    text: "……勇者不在。那就由你们转告他。第三层架的《北境水文残卷》,昨天日落前就该还回来了。"
  },
  {
    id: "m13",
    kind: "say",
    actorId: "eustice",
    expression: "f",
    text: "你、你什么时候站在那里的?算了……那卷宗是他为了明天的裂隙勘查借的,今晚一定送回去。"
  },
  {
    id: "m14",
    kind: "roll",
    label: "洞悉检定 · 尤斯缇丝",
    formula: "1d20+2",
    detail: "[4] + 2",
    total: 6,
    outcome: "fail"
  },
  {
    id: "m15",
    kind: "say",
    actorId: "lenore",
    expression: "g",
    text: "……那册卷宗,他查错了方向。(她忽然不再举着魔导书挡脸,语速平缓下来)西侧那道裂隙的瘴气浓度是季节性的,潮水退到最低时才会显形。让他改在后天清晨去。"
  },
  {
    id: "m16",
    kind: "say",
    actorId: "abyssa",
    expression: "h",
    text: "……蕾诺尔说的,是对的。(她重新缩回长发里)……勇者会处理。我睡了。"
  },
  {
    id: "m17",
    kind: "narration",
    text: "白骨之手无声地从阴影里探出,把一枚折好的纸条放在桌角——上面是两道用于排斥瘴气的符文。等众人再看向走廊尽头时,那里已经空了。"
  },
  { id: "m18", kind: "system", text: "本次预演结束" }
];
