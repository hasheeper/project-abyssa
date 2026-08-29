import abyssaAvatar from "../assets/avatar/abyssa.png";
import eloraAvatar from "../assets/avatar/elora.png";
import eusticeAvatar from "../assets/avatar/eustice.png";
import kororoAvatar from "../assets/avatar/kororo.png";
import lenoreAvatar from "../assets/avatar/lenore.png";
import mariettaAvatar from "../assets/avatar/marietta.png";
import normaAvatar from "../assets/avatar/norma.png";
import vivienneAvatar from "../assets/avatar/vivienne.png";
import type { RpActor, RpMessage } from "../components/RpScene";

/** 一幕:自带名册的一段演出。
    名册跟着幕走 —— 第二幕在魔王城,登场的是另一批人。 */
export interface RpSceneData {
  id: string;
  /** 幕题,预留给日后的幕间标题卡;当前仅作数据自述。 */
  title: string;
  actors: RpActor[];
  messages: RpMessage[];
}

/** 第一幕名册。name 上气泡标签,fullName / secondaryName 上席位名牌;
    取值对齐 demo/data.ts 的角色档案。 */
const ACT_ONE_ACTORS: RpActor[] = [
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

/** 第二幕名册。
    设定上所有人同住守望者之崖的洋馆(见 st/setting/current_situation),
    没有"两个阵营分居两地"这回事 —— 这一幕只是换了在场的四个人。
    accent 取各自的气质色:柯萝萝星辉紫、诺玛烟灰绿、
    玛丽埃塔绯线红、薇薇安血宴绛。 */
const ACT_TWO_ACTORS: RpActor[] = [
  {
    id: "kororo",
    name: "柯萝萝",
    fullName: "柯萝萝·拉普拉斯",
    secondaryName: "KORORO LAPLACE",
    avatar: kororoAvatar,
    accent: "#a89ae0"
  },
  {
    id: "norma",
    name: "诺玛",
    fullName: "诺玛·洛克",
    secondaryName: "NORMA LOCKE",
    avatar: normaAvatar,
    accent: "#9db8a4"
  },
  {
    id: "marietta",
    name: "玛丽埃塔",
    fullName: "玛丽埃塔·克雷格",
    secondaryName: "MARIETTA CRAIG",
    avatar: mariettaAvatar,
    accent: "#d98d8d"
  },
  {
    id: "vivienne",
    name: "薇薇安",
    fullName: "薇薇安·桑格温",
    secondaryName: "VIVIENNE SANGUINE",
    avatar: vivienneAvatar,
    accent: "#c2607a"
  }
];

const ACT_ONE_MESSAGES: RpMessage[] = [

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
  { id: "m18", kind: "system", text: "第一幕终" }
];

/** 第二幕:魔王城·裂隙的回信。
    衔接第一幕伏笔 —— 蕾诺尔说的西侧裂隙、被借走的《北境水文残卷》。
    地点换到魔王城,由玛丽埃塔的结界感知拉开序幕。 */
const ACT_TWO_MESSAGES: RpMessage[] = [
  { id: "s2m01", kind: "chapter", text: "第七日 · 申时的厨房动线" },
  {
    id: "s2m02",
    kind: "narration",
    text: "午后的洋馆西厨,烤炉正在预热。艾洛拉承诺过的布丁需要隔水慢烤,而厨房的使用权,按惯例要先经过女仆长的丝线丈量。玛丽埃塔立在操作台旁,指尖的红线已经把台面分出了泾渭分明的三个区域。"
  },
  {
    id: "s2m03",
    kind: "say",
    actorId: "marietta",
    expression: "a",
    text: "鸡蛋与牛乳放左侧,糖具居中,火钳与湿布在右手边。烤炉我已经校准过温度。艾洛拉小姐半刻后过来即可——在那之前,请诸位不要触碰台面上的任何东西。"
  },
  {
    id: "s2m04",
    kind: "narration",
    text: "话音落下的同时,操作台底下传来窸窸窣窣的响动。一顶巨大的星象魔女帽从桌布后面慢慢冒出来,帽檐下的人半睁着眼,怀里还抱着从沙发上顺来的抱枕。"
  },
  {
    id: "s2m05",
    kind: "say",
    actorId: "kororo",
    expression: "d",
    text: "……厨房挨着烤炉,是全馆最暖和的地方。柯萝萝我先来占位的,有意见吗。……没有的话,小声点,我再睡半刻。"
  },
  {
    id: "s2m06",
    kind: "say",
    actorId: "marietta",
    expression: "e",
    text: "…………"
  },
  {
    id: "s2m07",
    kind: "say",
    actorId: "marietta",
    expression: "a",
    text: "……柯萝萝小姐,操作台下不是就寝区域。不过,烤炉边确实比客厅暖和。我去取一条毯子——在布丁入炉之前,请务必挪到那张藤椅上。"
  },
  {
    id: "s2m08",
    kind: "narration",
    text: "厨房的高窗无声地开了一条缝。诺玛顺着窗沿滑进来,兜帽上的铁环一声没响——直到她看见台面上码好的那排食材,才叼着棒棒糖凑了过去。"
  },
  {
    id: "s2m09",
    kind: "say",
    actorId: "norma",
    expression: "c",
    text: "哟,今天的配给里居然有布丁?本人要预定两份。……别用那种眼神看我,女仆长,我可是替圣女大人跑腿买回鸡蛋的功臣,报销单都还没递呢。"
  },
  {
    id: "s2m10",
    kind: "roll",
    label: "顺手牵羊 · 诺玛",
    formula: "1d20+9",
    detail: "[3] + 9",
    total: 12,
    outcome: "fail"
  },
  {
    id: "s2m11",
    kind: "narration",
    text: "一根红线快过视线地缠上糖罐,把它从诺玛的指尖下平平移开,稳稳落回台面中央。糖罐的位置与先前分毫不差。"
  },
  {
    id: "s2m12",
    kind: "say",
    actorId: "marietta",
    expression: "a",
    text: "功劳我会如实记入账目,报销也会在今晚结清。但配给是配给,预支是预支。……另外,方才那一下,按宅邸的规矩应当没收兜帽一日,姑且记在账上。"
  },
  {
    id: "s2m13",
    kind: "say",
    actorId: "vivienne",
    expression: "b",
    text: "嗯哼哼~♪ 好热闹的厨房。我可是循着甜味特地下楼的哦。……布丁这种庶民点心,配我库里那瓶陈年血橙利口酒,勉强能端上台面呢~"
  },
  {
    id: "s2m14",
    kind: "say",
    actorId: "norma",
    expression: "k",
    text: "(咔嚓)……喂,蕾丝扇的,你那瓶酒上个月记在外务账上,三百四十枚金币。就是你害得全馆这个月预算见底、圣女大人满集市讨价还价,老娘可都记着呢。"
  },
  {
    id: "s2m15",
    kind: "say",
    actorId: "vivienne",
    expression: "l",
    text: "……哎呀,连你也开始学那位大人翻账本了?真是没情趣。(扇骨在掌心冷冷敲了两下)那瓶酒是用来招待商盟特使的必要开销——他签下的粮价配额,够你们买一万个布丁哦。"
  },
  {
    id: "s2m16",
    kind: "say",
    actorId: "kororo",
    expression: "c",
    text: "一万个……那不就是,今后每天都有布丁。……薇薇安,干得好。柯萝萝我允许你分走今天的一份了。"
  },
  {
    id: "s2m17",
    kind: "narration",
    text: "烤炉的预热钟轻轻响了一声。玛丽埃塔展开毯子搭在藤椅上,红线同时把糖罐、蛋盒与牛乳壶朝左侧推齐了半寸。窗外的海风掠过蔷薇藤,厨房里只剩下炉火安稳的噼啪声——离艾洛拉到来,还有半刻。"
  },
  { id: "s2m18", kind: "system", text: "第二幕终" }
];

/** 全部幕。幕序即数组序。 */
export const SCENES: RpSceneData[] = [
  { id: "act-1", title: "月末的长桌", actors: ACT_ONE_ACTORS, messages: ACT_ONE_MESSAGES },
  { id: "act-2", title: "申时的厨房动线", actors: ACT_TWO_ACTORS, messages: ACT_TWO_MESSAGES }
];

/** 兼容旧引用:第一幕的名册与消息。 */
export const ACTORS = ACT_ONE_ACTORS;
export const TRANSCRIPT = ACT_ONE_MESSAGES;
