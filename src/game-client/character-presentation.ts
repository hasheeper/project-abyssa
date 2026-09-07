import { archiveIdentities } from "../content/characters/identities";
import { presentCharacterChronicle } from "./character-chronicle";
import { relationshipArt } from "../content/characters/relationshipArt";
import type {
  CharacterArchiveView,
  ArchiveCharacterView,
} from "../game-runtime/character-views";
import type { CharacterArchiveProfile } from "../shared/domain/characters/archive";
import type { CharacterChronicle } from "../shared/domain/characters/chronicle";
import type {
  DieFaceAction,
  DieSuit,
  LiveCharacterDiceLoadout,
  ArchiveEquipmentSlot,
} from "../shared/domain/dice/face";
import type { DemoActionKind, DemoSuit } from "../game-core/contracts";

const suits: Record<DemoSuit, DieSuit> = {
  light: "holy",
  earth: "earth",
  abyss: "abyss",
  beyond: "beyond",
};
const actions: Record<
  DemoActionKind,
  { icon: DieFaceAction; label: string; description: string }
> = {
  attack: {
    icon: "attack",
    label: "攻击",
    description: "对指定敌人造成伤害。",
  },
  guard: {
    icon: "guard",
    label: "格挡",
    description: "抵挡指定敌人的攻击意图。",
  },
  heal: { icon: "heal", label: "治疗", description: "恢复存活同伴的生命。" },
  wild: {
    icon: "wild",
    label: "万能行动",
    description: "可选择攻击、格挡或治疗；不改变花色和命点。",
  },
  blank: {
    icon: "blank",
    label: "空面",
    description: "没有主动动作；命数已醒时仍可参与成牌。",
  },
  protect: {
    icon: "guard",
    label: "护卫",
    description: "选择一条敌方攻击意图格挡；目标是其他同伴时额外格挡 1。",
  },
  "expensive-heal": {
    icon: "heal",
    label: "昂贵治疗",
    description:
      "治疗受伤的存活同伴并支付 10 散金；不足时扣除现有散金，仍能治疗。",
  },
  "cleave-left": {
    icon: "attack",
    label: "向左顺劈",
    description:
      "攻击主目标，并对行动开始时其左侧相邻敌人造成 1 伤害；主目标死亡不改换波及对象。",
  },
  "cleave-right": {
    icon: "attack",
    label: "向右顺劈",
    description:
      "攻击主目标，并对行动开始时其右侧相邻敌人造成 1 伤害；主目标死亡不改换波及对象。",
  },
  bind: {
    icon: "art",
    label: "提线",
    description:
      "目标生命不高于施术者生命上限的 1.5 倍（向上取整）时可提线；目标低于半血时改为 2 倍，门槛最高为 6。首次取消其本回合意图并留下缠线；挣脱后再次提线只补缠线。",
  },
  "guard-all": {
    icon: "guard",
    label: "红线迷宫",
    description: "为每条适用的敌方攻击意图提供格挡。",
  },
  "thread-strike": {
    icon: "attack",
    label: "绞杀红线",
    description: "攻击指定目标；若目标有缠线，消费该缠线并使本次伤害 +2。",
  },
};
const legacyActions: Record<string, string> = {
  attack: "攻击",
  guard: "格挡",
  heal: "治疗",
  coin: "窃取",
  wild: "万能行动",
  blank: "空面",
};
export const equipmentNames: Record<string, string> = {
  "equipment.spare-blade": "备用短刃",
  "equipment.emergency-pouch": "应急药囊",
};
const covenantNames: Record<string, string> = {
  "covenant.eustice": "王权领域",
  "covenant.elora": "越限奇迹",
  "covenant.kororo": "渊星重压",
  "covenant.norma": "无音步",
};
const qualityNames = { plain: "素", gild: "金", rust: "锈", none: "无铭" };

function covenantText(
  ch: Extract<ArchiveCharacterView, { version: 2 }>,
  stage = ch.config.covenantStage,
) {
  if (ch.formationCovenant) return {name: "女仆长的领域", trigger: "五个有效骰形成3＋2、4＋1或五同点时", currentTerm: `在其余铭约后重排敌方阵位，最多${stage === 2 ? 2 : 1}次相邻交换；既有出手顺序不变。`, currentStage: stage, iconUrl: relationshipArt[ch.id]?.iconUrl, stageLabels: ["初铭", "现行", "重签"], stageLimit: 2};
  const c = ch.covenant;
  if (!c) return null;
  const range = c.stages[stage - 1],
    amount =
      range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  const trigger = {
    flush: "同花成型时",
    triple: "三条成型时",
    straight: "顺子成型时",
    "two-pair-blank": "两对成型且存在空面时",
  }[c.pattern];
  const term = {
    "threat-damage": `对最高威胁敌人造成 ${amount} 伤害；无攻击意图时选择最低生命敌人。`,
    healing: `为生命最低的 ${amount} 名受伤存活同伴各恢复 1 生命。${stage === 2 ? "并为最低生命存活同伴解除封印。" : ""}`,
    "execution-damage": `选择 ${amount} 个不同目标，各造成 3 伤害；优先可斩杀目标。`,
    knives: `投出 ${amount} 枚飞刀，每枚对随机存活敌人造成 1 伤害。`,
  }[c.effect];
  return {
    name: covenantNames[c.id] ?? "铭约",
    trigger,
    currentTerm: term,
    currentStage: stage,
    iconUrl: relationshipArt[ch.id]?.iconUrl,
    stageLabels: ["初铭", "现行", "重签"],
    stageLimit: 2,
  };
}
function growthText(
  ch: Extract<ArchiveCharacterView, { version: 2 }>,
  leaderId: string,
) {
  if (ch.id === leaderId)
    return `团队里程碑：${ch.teamLevel3Ids.length} 人达到 Lv.3；${ch.teamLevel3Ids.length >= 2 ? "护卫面已变金" : "任意两人达到 Lv.3 后，护卫面变金"}。`;
  if (!ch.next) return "Lv.3 · 已达本 DEMO 成长上限。";
  const changes = ch.next.faces.flatMap((f, i) => {
    const old = ch.config.faces[i],
      details = [];
    if (old.fate !== f.fate) details.push("命数唤醒");
    if (old.quality !== f.quality)
      details.push(`${qualityNames[old.quality]}→${qualityNames[f.quality]}`);
    return details.length ? [`第 ${f.slot} 面：${details.join("、")}`] : [];
  });
  if (ch.next.covenantStage !== ch.config.covenantStage)
    changes.push(
      `铭约进入现行。${covenantText(ch, ch.next.covenantStage)?.currentTerm ?? "该能力尚未配置"}`,
    );
  return `下一成长 Lv.${ch.next.level}（预览）：${changes.join("；")}。`;
}
export function presentDice(
  ch: ArchiveCharacterView,
  leaderId: string,
): LiveCharacterDiceLoadout {
  const scope = ch.inRun ? "本趟远征 · 冻结配置" : "长期配置";
  if (ch.version === 1)
    return {
      characterId: ch.id,
      live: {
        version: 1,
        scope,
        growth: "当前档案使用旧版规则，未提供正式角色成长。",
        slots: [
          {
            id: "legacy",
            label: "旧版装备",
            state: "legacy",
            description: ch.equipment.length
              ? ch.equipment
                  .map(
                    (e) =>
                      `已携带装备 · 耐久 ${e.durability}/${e.maxDurability}`,
                  )
                  .join("；")
              : "当前配置没有旧版装备。此版本不提供正式三槽系统。",
          },
        ],
      },
      faces: ch.faces.map((f, i) => ({
        face: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        pip: f.pip,
        wildPip: f.wildPip,
        action: f.verb,
        power: f.power,
        fate: f.quality === "none" ? "asleep" : "awake",
        suit: "earth",
        live: {
          id: `legacy.${ch.id}.${i + 1}`,
          quality: f.quality,
          baseQuality: f.baseQuality,
          pip: f.wildPip ? { kind: "wild" } : { kind: "natural", value: f.pip },
          suitKnown: false,
          actionLabel: legacyActions[f.verb],
          description: `${f.label}。按当前档案的旧版战斗规则生效。`,
          rust:
            f.quality === "rust"
              ? f.baseQuality === "rust"
                ? "legacy"
                : "temporary"
              : "none",
        },
      })),
    };
  const item = ch.equipment[0];
  const slots: ArchiveEquipmentSlot[] = [
    {
      id: "exclusive",
      label: "专武",
      state: "unavailable",
      description: "本 DEMO 未开放专武。",
    },
    {
      id: "accessory",
      label: "小件",
      state: "unavailable",
      description: "本 DEMO 未开放小件。",
    },
    {
      id: "general",
      label: "通用",
      state: !ch.generalApplicable
        ? "inapplicable"
        : item
          ? "equipped"
          : "empty",
      description: !ch.generalApplicable
        ? "没有原生空面，不适用空面装备。"
        : item
          ? `全部原生空面改为${item.definition.replacement === "attack" ? "攻击" : "治疗"} ${item.definition.power}；不改变命数、品质、点数或花色。`
          : "当前配置未装备通用物品。",
      ...(item
        ? {
            name: equipmentNames[item.definitionId] ?? "通用装备",
            instanceId: item.instanceId,
            icon: item.definition.replacement,
          }
        : {}),
    },
  ];
  return {
    characterId: ch.id,
    primarySuit: ch.config.suits[0] ? suits[ch.config.suits[0]] : undefined,
    secondarySuit: ch.config.suits[1] ? suits[ch.config.suits[1]] : undefined,
    live: { version: 2, scope, slots, growth: growthText(ch, leaderId) },
    faces: ch.faces.map((f, i) => {
      const a = actions[ch.actions[f.actionId].kind],
        base = ch.baseFaces[i];
      return {
        face: f.slot as 1 | 2 | 3 | 4 | 5 | 6,
        pip: f.pip.kind === "natural" ? f.pip.value : 1,
        wildPip: f.pip.kind === "wild",
        action: a.icon,
        power: f.power,
        fate: f.fate,
        suit: suits[f.suit],
        live: {
          id: f.id,
          quality: f.quality,
          baseQuality: ch.config.faces[i].quality,
          pip: f.pip,
          suitKnown: true,
          actionLabel: a.label,
          description: a.description,
          rust: ch.temporaryRust.includes(f.id) ? "temporary" : f.rust,
          ...(base.actionId !== f.actionId && item
            ? {
                replacement: `${equipmentNames[item.definitionId]}：${actions[ch.actions[base.actionId].kind].label}→${a.label} ${f.power}`,
              }
            : {}),
        },
      };
    }),
  };
}
export function presentCharacterArchive(view: CharacterArchiveView) {
  const order = ["kael", "eustice", "elora", "kororo", "norma", "marietta"];
  const ids = [
    ...new Set([
      ...order,
      ...view.characters.map((c) => c.id),
      ...archiveIdentities.map((c) => c.id),
    ]),
  ];
  return ids.map((id) => {
    const ch: ArchiveCharacterView | undefined = view.characters.find(
      (c) => c.id === id,
    );
    const identity = archiveIdentities.find((c) => c.id === id);
    const profile: CharacterArchiveProfile = identity
      ? { ...identity, status: { ...identity.status } }
      : {
          id,
          number: "—",
          name: ch?.name ?? "未知角色",
          status: { title: "角色资料" },
        };
    profile.status.statusChips = ch
      ? [
          {
            label: ch.inRun
              ? "本趟成员"
              : ch.available
                ? "可出征"
                : "亲征未开放",
          },
          ...(ch.hp !== null
            ? [
                {
                  label: `生命 ${ch.hp}/${ch.maxHp}`,
                  ...(ch.downed
                    ? { detail: "已倒地", tone: "danger" as const }
                    : {}),
                },
              ]
            : []),
        ]
      : [{ label: "人物资料", detail: "此版本未开放战斗规则" }];
    profile.status.state = ch?.inRun ? "本趟配置" : "长期档案";
    if (id !== view.leaderId) {
      profile.status.bond = {
        level: ch?.version === 2 ? ch.config.level : null,
        slots: 5,
        maxLevel: ch?.version === 2 ? 3 : undefined,
        discrete: true,
      };
      profile.status.pact = (ch?.version === 2 ? covenantText(ch) : null) ?? {
        ...(relationshipArt[id] ?? { name: "私约" }),
        currentStage: null,
        trigger: "此版本未记录",
        currentTerm: "尚无可读取的私约进度。",
      };
    }
    const dice = ch
      ? presentDice(ch, view.leaderId)
      : {
          characterId: id,
          faces: [],
          placeholderTitle: "此版本未开放骰装",
          placeholderNote: "此版本没有该人物的战斗配置；身份资料仍可查阅。",
        };
    const notes = !ch
      ? "人物背景来自作者资料。"
      : ch.version === 1
        ? "旧版档案 · 未提供独立羁绊与篇章进度。"
        : [
            id === view.leaderId
              ? growthText(ch, view.leaderId)
              : view.contentRef.rulesVersion === 4
                ? view.runRef?.kind === "memory" && ch.inRun
                  ? "回忆固定配置；当下成长不受影响。"
                  : `当前羁绊 Lv.${ch.config.level}。${ch.config.level === 3 ? "已达本 DEMO 成长上限。" : "成长片段在洋馆查看。"}`
                : "篇章进度尚无可读取的记录。",
            !ch.covenant && id !== view.leaderId
              ? "此内容版本尚未配置该角色铭约。"
              : "",
            id === "marietta" && !ch.available
              ? "先通庄园，再完成回忆，开放玛丽埃塔亲征。"
              : "",
          ]
            .filter(Boolean)
            .join(" ");
    return {
      profile,
      dice,
      notes,
      chronicle: ch
        ? presentCharacterChronicle(ch.id, ch.history)
        : ({
            characterId: id,
            blocks: [],
            placeholderNote: "暂无可记录的冒险经历。",
          } as CharacterChronicle),
    };
  });
}
