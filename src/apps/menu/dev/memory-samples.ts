import type { MemoryEntry } from "../../../game-client/memory/memory-types";
import corridor from "../../../assets/memory/corridor.webp";
import leaves from "../../../assets/memory/leaves.webp";
import tower from "../../../assets/memory/tower.webp";
import candles from "../../../assets/memory/candles.webp";

// Layout samples only. This module is imported by tests and the DEV-only menu preview.
export const memoryFixtures: readonly MemoryEntry[] = [
  { id: "sample-corridor", day: 9, phase: "夜晚", sequence: 5, title: "走廊里的脚步声", actors: ["玛丽埃塔"], location: "洋馆", artwork: corridor,
    preview: "夜晚，回廊尽头传来断续的脚步声。等我赶到时，只看见摇曳的烛光，以及风穿过长廊的回响。",
    blocks: [{ text: "深夜时，我在回廊尽头听见脚步声。" }, { text: "那声音很轻，像有人刻意放慢了步伐，却又在我接近时悄然止住。" },
      { text: "我提着灯走过去，回廊空无一人。只有风穿过拱窗，带起一阵潮湿的气息。窗下搁着一本摊开的旧书，书页压在烛台底下，边角已经卷起。" },
      { speaker: "玛丽埃塔", text: "“这边的窗扣松了，夜里风一大，声音能传到楼梯口。”" },
      { text: "她从另一头走来，把窗重新关好。我将旧书合上，放回靠墙的书架。" },
      { kind: "choice", text: "我选择留下来，和她一起检查走廊。" }, { text: "我们沿着回廊走了一遍。烛台里的灯芯快烧尽了，她换上一根新的，火光很快稳了下来。" },
      { text: "回到楼梯口时，远处又传来一声轻响。这一次，我们都停住了脚步。" }] },
  { id: "sample-dinner", day: 9, phase: "黄昏", sequence: 4, title: "晚餐之后", actors: ["艾洛拉"], location: "餐厅", artwork: candles,
    preview: "餐具收拢，杯中的茶还温着。她在桌边坐了一会儿，问起今天的巡守。",
    blocks: [{ text: "餐厅里的灯只剩下桌边的两盏。艾洛拉收起最后一只盘子，又给我添了一点热茶。" }, { speaker: "艾洛拉", text: "“今天回来得比平时晚。路上还顺利吗？”" }, { text: "我把巡守时遇到的事情讲给她听。窗外开始落雨，我们坐着等那壶茶慢慢凉下来。" }] },
  { id: "sample-return", day: 8, phase: "清晨", sequence: 3, title: "归来之后", actors: [], location: "洋馆", artwork: leaves,
    preview: "离开许久的地方，再次出现在视野中。熟悉的窗影和花木都还留在原处。",
    blocks: [{ text: "船靠岸时天刚亮。通向洋馆的小路积着薄薄的雨水，石阶两边的草木长高了许多。" }, { text: "我推开门，将行囊放在长椅上。走廊里有人开了窗，清晨的空气带着海水和泥土的气味。" }] },
  { id: "sample-clock", day: 7, phase: "午后", sequence: 2, title: "停下来的钟声", actors: ["玛丽埃塔"], location: "钟楼", artwork: tower,
    preview: "高塔的钟在午后突然停止了。我们沿着狭窄的楼梯向上，寻找声音停下的原因。",
    blocks: [{ text: "钟楼的门很久没有打开，门轴转动时发出低哑的声响。" }, { text: "楼梯上落着灰。我们数着台阶向上，到了最顶端，才看见一小截断裂的铜链垂在钟摆旁边。" }, { speaker: "玛丽埃塔", text: "“得先把它卸下来。替我扶一下灯。”" }, { text: "午后的光从狭小的窗洞照进来。我们把拆下的零件依次放好，等着下一次钟声。" }] },
  { id: "sample-promise", day: 6, phase: "黄昏", sequence: 1, title: "共同的约定", actors: ["尤斯缇丝"], location: "休息室", artwork: candles,
    preview: "出发的安排已经写在纸上。她最后核对了一次路线，将灯移到地图旁。",
    blocks: [{ text: "地图摊在休息室的桌面上，几处转弯用铅笔做了标记。" }, { speaker: "尤斯缇丝", text: "“到这里之后等我。天黑以前，我们一起回来。”" }, { text: "我点了点头，将路线再看了一遍。她把地图折好，递到我手里。" }] },
  { id: "sample-rain", day: 5, phase: "夜晚", sequence: 5, title: "雨停以前", actors: ["诺玛"], location: "门廊", artwork: corridor,
    preview: "门廊下放着刚收回的工具。我们等了一阵雨，才把剩下的木料搬进屋。",
    blocks: [{ text: "雨水顺着屋檐落下，院子里的石路被冲洗得很亮。诺玛挪开门边的木桶，为最后一捆木料腾出位置。" }, { text: "搬完东西时，雨已经小了。她拍掉袖子上的水，回头确认每一扇门都关好了。" }] },
  { id: "sample-herbs", day: 4, phase: "午后", sequence: 4, title: "窗台上的新叶", actors: ["柯萝萝"], location: "温室", artwork: leaves,
    preview: "几只小盆沿窗排开。新长出的叶子还没完全展开，阳光已经照到了盆沿。",
    blocks: [{ text: "柯萝萝把一只小盆移到窗边，让我看叶片背面的浅色纹路。她记下今天浇水的时间，又转身去照料另一排幼苗。" }] },
  { id: "sample-letter", day: 3, phase: "清晨", sequence: 3, title: "一封没有署名、暂时留在书架第二层的来信", actors: [], location: "书房",
    preview: "信纸折了两次，放在旧目录下面。里面只有几行字，没有日期，也没有落款。",
    blocks: [{ text: "整理书架时，我在旧目录下面发现了一封信。纸张已经泛黄，折痕却很整齐。" }, { text: "我读过那几行字，又照原样折好，把它放回了书架的第二层。" }] },
  { id: "sample-first", day: 1, phase: "黄昏", sequence: 1, title: "初到洋馆", actors: [], location: "洋馆", artwork: tower,
    preview: "海风从山坡上吹来。门开着，里面有人点亮了第一盏灯。",
    blocks: [{ text: "走到山坡尽头，洋馆才完整地出现在眼前。墙角覆着潮湿的藤蔓，门前的灯还没有亮。" }, { text: "我抬手叩门。过了一会儿，里面传来脚步声。" }] },
  { id: "sample-unknown", day: null, phase: "", sequence: 0, title: "旧手记", actors: [],
    preview: "留下来的几页记录没有标注日期。纸页上的字迹依然清晰。", blocks: [{ text: "这几页记录没有标注日期。它们夹在书里，和其他已经读过的篇章收在一起。" }] },
];
