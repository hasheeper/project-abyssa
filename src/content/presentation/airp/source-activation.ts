/** Document-level selection, not semantic retrieval or a Tavern lorebook engine. */
const keywords: Record<string, string[]> = {
  history: ["历史", "纪元", "诸神", "创世", "末日战争", "总体战争", "伪典圣战"],
  prequel: ["前传", "伪典", "圣战", "雨夜", "断粮", "督军", "肃清指令", "灭口", "寝殿", "政治筹码", "小队结成", "结盟"],
  "human-realms": ["人类诸国", "人类王国", "王都", "教廷", "军校", "贵族", "摄政", "王冠", "商盟", "人类高层"],
  "abyssal-court": ["王庭", "四席", "摄政", "魔族", "阿尔薇特", "蕾诺尔", "玛莉耶塔", "玛丽埃塔", "薇薇安", "贡赋", "领主"],
  institutions: ["教廷", "教会", "教义", "神职", "神官", "勇者制度", "魔王制度", "法位", "四席", "代理人", "正统", "什一税"],
  economy: ["金钱", "铜", "银币", "金币", "里拉", "买", "卖", "钱", "价格", "报价", "账", "交易", "商店", "集市", "黑市", "经费", "报销", "预算", "水晶", "维修", "补给"],
  dice: ["明暗骰", "骰子", "骰局", "赌", "牌型", "筹码", "明蛊", "暗骰", "dice"],
};

export function withSourceActivation<T extends {id: string; kind: string; text: string}>(sources: readonly T[]): (T & {activation?: {always: boolean; keywords: string[]}; brief?: string})[] {
  return sources.map(s => {
    if (s.kind === "world") {
      const always = s.id === "world" || s.id === "current" || s.id === "household-guidance";
      if (!always && !keywords[s.id]) throw Error(`Missing world activation: ${s.id}`);
      return {...s, activation: {always, keywords: keywords[s.id] ?? []}};
    }
    if (s.kind === "character") {
      // Verbatim identity/core-color fields, not a rewritten substitute for the full card.
      const fields = [...s.text.matchAll(/^    (name|identity|core_color): "(.+)"\s*$/gm)];
      if (fields.length !== 3) throw Error(`Missing character brief fields: ${s.id}`);
      return {...s, brief: fields.map(m => `${m[1]}：${m[2]}`).join("\n")};
    }
    return s;
  });
}
