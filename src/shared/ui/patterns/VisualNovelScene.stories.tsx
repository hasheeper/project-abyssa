import type { Meta, StoryObj } from "@storybook/react-vite";
import { VisualNovelScene } from "./VisualNovelScene";
import { PaperDoll } from "./PaperDoll";
import { CHARACTER_CALIBRATION } from "./spriteCalibration";
import shopBg from "../../../assets/bg/shop.png";

const ALL_CHARS = ["abyssa", "alvitr", "elora", "eustice", "kororo", "lenore", "marietta", "norma", "tibby", "vivienne"];

const meta = {
  title: "Compositions/VisualNovelScene",
  component: VisualNovelScene,
  parameters: { layout: "fullscreen" }
} satisfies Meta<typeof VisualNovelScene>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (args: Parameters<typeof VisualNovelScene>[0]) => (
  <div style={{ height: "100vh" }}>
    <VisualNovelScene {...args} />
  </div>
);

/* 双人对话:位置固定,未说话者保留表情 */
export const TwoPeople: Story = {
  args: {
    background: shopBg,
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" }
    ],
    script: [
      { characterId: "eustice", expression: "g", text: "艾洛拉,过来。今天的巡逻路线,我要再确认一遍。" },
      { characterId: "elora", expression: "b", text: "是是——尤斯缇丝队长,从早上开始就这么严肃。" },
      { characterId: "eustice", expression: "k", text: "……你刚才是不是又把我的地图画满了涂鸦?" },
      { characterId: "elora", expression: "i", text: "那、那个是……战术标记!对,战术标记!" },
      { characterId: "eustice", expression: "e", text: "狡辩也没用。今晚的报告加倍,没得商量。" },
      { characterId: "elora", expression: "d", text: "呜……早知道就不手痒了……" },
      { characterId: "eustice", expression: "h", text: "唉。……算了,先吃饭。吃完再罚。" },
      { characterId: "elora", expression: "c", text: "真的吗?!尤斯缇丝最好了!" }
    ]
  },
  render: frame
};

/* 三人对话:第三人入场顶掉最旧者,位置轮换 */
export const ThreePeople: Story = {
  args: {
    background: shopBg,
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" },
      { characterId: "kororo", name: "可洛洛" }
    ],
    script: [
      { characterId: "eustice", expression: "a", text: "集合完毕。今天的任务是护送商队穿过东门大道。" },
      { characterId: "elora", expression: "f", text: "哎?就我们两个吗?听说那边最近有魔物出没……" },
      { characterId: "eustice", expression: "l", text: "怕了?跟紧我就行。我的剑还没钝。" },
      { characterId: "kororo", expression: "c", text: "等等——!也算我一个!护送任务有报酬吧,有报酬吧?" },
      { characterId: "elora", expression: "j", text: "可洛洛?!你什么时候跟过来的……" },
      { characterId: "kororo", expression: "wink", text: "嘿嘿,从你们说『东门大道』的时候就在啦。赚了钱我请客!" },
      { characterId: "eustice", expression: "k", text: "……随便你。但是不许冲在最前面,听指挥。" },
      { characterId: "kororo", expression: "e", text: "什么嘛!我的实力你还不放心吗?" },
      { characterId: "elora", expression: "i", text: "(小声)就是因为不放心才……" },
      { characterId: "eustice", expression: "h", text: "好了,出发。都给我活着回来,这是命令。" }
    ]
  },
  render: frame
};

/* 四人对话:槽位持续轮换,考验最旧者替换与表情记忆 */
export const FourPeople: Story = {
  args: {
    background: shopBg,
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" },
      { characterId: "kororo", name: "可洛洛" },
      { characterId: "vivienne", name: "薇薇安" }
    ],
    script: [
      { characterId: "eustice", expression: "g", text: "紧急会议。刚才接到报告,北边的结界出现了裂缝。" },
      { characterId: "elora", expression: "n", text: "裂、裂缝?!怎么会,上个月才加固过……" },
      { characterId: "kororo", expression: "f", text: "哇,听起来很严重。要打架了吗?" },
      { characterId: "vivienne", expression: "b", text: "哎呀,一大早就这么热闹。……让我看看那份报告?" },
      { characterId: "eustice", expression: "a", text: "薇薇安,你来得正好。结界的事,你最清楚。" },
      { characterId: "vivienne", expression: "g", text: "嗯……这不是自然老化。是有人从外部,一点一点腐蚀的。" },
      { characterId: "elora", expression: "e", text: "人为的?!谁会做这种事……" },
      { characterId: "kororo", expression: "k", text: "哼,不管是谁,被我逮到就完了。" },
      { characterId: "vivienne", expression: "l", text: "冷静点。对方很谨慎,我们得先修复结界,再设下反向追踪。" },
      { characterId: "eustice", expression: "l", text: "好。艾洛拉准备修复材料,可洛洛跟我去现场,薇薇安坐镇中枢。" },
      { characterId: "elora", expression: "a", text: "明白!" },
      { characterId: "kororo", expression: "c", text: "收到!这次一定要抓到犯人!" },
      { characterId: "vivienne", expression: "h", text: "呵呵……那么就,祝各位武运昌隆。" }
    ]
  },
  render: frame
};

/* 十人平铺对照:同底对齐,便于逐角色微调 scale/x/y。
   顶部实时显示每个角色当前校准值,调 spriteCalibration.ts 即可。 */
export const CalibrationSheet: Story = {
  args: { actors: [], script: [] },
  render: () => (
    <div style={{ minHeight: "100vh", background: "#161a1a", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, borderBottom: "2px solid #72b3b7" }}>
        {ALL_CHARS.map((id) => {
          const c = CHARACTER_CALIBRATION[id] ?? {};
          return (
            <div key={id} style={{ flex: 1, textAlign: "center", color: "#c2cbcb" }}>
              <div style={{ height: 420, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "#1d2121" }}>
                <PaperDoll characterId={id} expression="a" width="100%" />
              </div>
              <div style={{ fontSize: 11, padding: "6px 2px", fontFamily: "monospace", lineHeight: 1.5 }}>
                <div style={{ color: "#72b3b7", fontWeight: 700 }}>{id}</div>
                <div>s:{(c.scale ?? 1).toFixed(2)} x:{(c.x ?? 0).toFixed(3)} y:{(c.y ?? 0).toFixed(3)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
};

export const ExpressionGallery: Story = {
  args: { actors: [], script: [] },
  render: () => (
    <div style={{ display: "flex", gap: 16, padding: 24, background: "#1d2121", flexWrap: "wrap" }}>
      {(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"] as const).map((expr) => (
        <div key={expr} style={{ width: 120, textAlign: "center", color: "#c2cbcb" }}>
          <PaperDoll characterId="abyssa" expression={expr} />
          <div style={{ fontSize: 12, marginTop: 4 }}>{expr}</div>
        </div>
      ))}
      <div style={{ width: 120, textAlign: "center", color: "#c2cbcb" }}>
        <PaperDoll characterId="abyssa" expression="star-eyes" />
        <div style={{ fontSize: 12, marginTop: 4 }}>star-eyes</div>
      </div>
    </div>
  )
};
