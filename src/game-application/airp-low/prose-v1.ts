import {check} from "../airp-generation/contracts";

/** Context21 opts into these two runtime module edits; the r8 source stays immutable. */
export const PROSE_SETTING_ID = "451043ae-17bf-4162-a45f-2f80eb42ba67";
export const PROSE_ROLEPLAY_ID = "7e39767c-e29b-4543-8f38-1f96d340ca39";

// Refined from the user's anti-caricature requirement (Fable c-a99534bd / t-fee04be9).
const ROLEPLAY_REPLACEMENTS = [
  ["不追求张力：你需要的不是戏剧张力与吸引读者的高潮迭起，而是令人感到舒服的平和文字，你不必强行制造爆点爽点，按照用户指示的走向平稳规划剧情即可",
    "平常交流不必追求戏剧高潮，不强造爆点爽点；出现实际分歧或情绪变化时，按其程度呈现，不强行放大，也不一概抹平"],
  ["角色性格恒定：不夸张化角色反应，你需要让**性格**大于**情绪**，无论角色情绪如何，保持其性格底色",
    "角色连贯：保持性格底色与动机合理，具体反应结合当下处境、心情和关系；不因一时情绪随意改变人物，也不要求人物在不同情境下始终作出同一种反应"],
  ["角色驱动型剧情：剧情基于角色展开，根据角色性格构造能够展现该角色“萌点”的剧情，而不是让角色性格根据剧情变化",
    "事件依照已有事实与人物合理的选择发展，不为展示“萌点”强造冲突或改变事实，也不为推进情节省略人物应有的反应"],
  ["不刻意突出角色特质：角色的特质只是性格的一部分，不需要刻意突出塑造，不刻意表现就是最好的表现",
    "按当前处境演绎人物：性格、偏好与关系应结合人物所知、当下目标和心情，影响理解、措辞与选择。同一特质可以有不同表现，也可以暂不显露；日常行为不必处处体现性格"],
  ["保证角色对白含有情绪，保证角色的对白是符合生活气息接地气的",
    "对白符合日常交流，情绪按当前处境自然呈现，不要求每句话都强调情绪"],
  ["性格合理：保证角色动机合理，淡化角色性格。保证情节大于角色，不刻板化角色行为",
    "避免用少数标签代替完整人物：不要为证明性格而反复安排口癖、招牌动作、夸张反应或固定拌嘴。当特质确实与眼前的事相关时，保留人物合理的偏好、立场和情绪"]
] as const;

export function contextualRoleplayGuide(original: string) {
  let content = original;
  for (const [from, to] of ROLEPLAY_REPLACEMENTS) {
    check(content.includes(from), "Frozen roleplay clause changed");
    content = content.replace(from, to);
  }
  return content;
}

export function elasticProseLength(suggestedWords?: number) {
  const target = suggestedWords === undefined
    ? "三段合计篇幅由当前交流所需的新增内容决定，不设固定字数或自然段数；仅需承接态度、简短补充或收尾时简短完成，有必要的新问题或进展时展开"
    : `三段合计参考${suggestedWords}字，段数随本轮内容自然变化；这是基于上一轮情况的软目标，不是最低字数或上限，回应充分即可收束，实际选择带来新问题或必要交流时可相应展开`;
  return `${target}；原三段结构保留，各段可短，共同完成当前交流，不为每段另造新话题`;
}
