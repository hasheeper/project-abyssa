import type { CharacterEmotionProfile, EmotionCue, EmotionEmoteId, EmotionMotionId } from "../../shared/domain/presentation/emotion";

const cue = (expression: string, emote: EmotionEmoteId | null = null, id?: EmotionMotionId, amplitude = 12, duration = 520): EmotionCue =>
  ({ expression, emote, motion: id ? { id, amplitude, duration } : null });

/** Based on st/setting/char personality facets. Stillness is an intentional action choice.
 * No hearts for generic joy; no sleepy symbol just because someone closes their eyes.
 * Motion references: nod 15px, jump 72px, waver 8px, light shake 12px.
 * Jump and shake amplitudes remain readable after the shared 1600px stage scales down.
 * The existing face recipes remain intact; amplitude and tempo belong to each character.
 */
export const CHARACTER_EMOTION_PROFILES: Record<string, CharacterEmotionProfile> = {
  abyssa: {
    direction: "三无幼猫：缓慢、小幅；威胁时反而静止，兴致主要从眼睛与漫符露出。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", "sparkle", "nod", 10, 680),
      sad: cue("d", "gloom"), angry: cue("e"), surprised: cue("f", "question"),
      serious: cue("g"), closed: cue("h", "sleepy"), wry: cue("i"),
      flustered: cue("j", "ellipsis"), displeased: cue("k", "ellipsis"), confident: cue("l"),
      confused: cue("m", "question"), panicked: cue("n", "exclaim", "shakeLight", 9, 530),
    },
    specials: { "star-eyes": cue("star-eyes", "sparkle", "nod", 12, 620), "cat-mouth": cue("cat-mouth", "note") },
  },
  alvitr: {
    direction: "克制老兵：稳住重心，认可才轻颔首；不跳跃、不用夸张冷汗表达警戒。",
    cues: {
      neutral: cue("a"), smile: cue("b", null, "nod", 10, 480), joy: cue("c", null, "nod", 12, 500),
      sad: cue("d"), angry: cue("e"), surprised: cue("f", "exclaim"),
      serious: cue("g"), closed: cue("h"), wry: cue("i"), flustered: cue("j", "ellipsis"),
      displeased: cue("k"), confident: cue("l", null, "nod", 10, 440),
      confused: cue("m", "question"), panicked: cue("n", null, "shakeLight", 9, 420),
    },
  },
  elora: {
    direction: "柔软而固执：喜悦轻快，生气像认真制止；担心与羞窘允许轻微动摇。",
    cues: {
      neutral: cue("a"), smile: cue("b", null, "nod", 12, 580), joy: cue("c", "note", "jump", 64, 760),
      sad: cue("d", "gloom"), angry: cue("e", "anger", "nod", 15, 470),
      surprised: cue("f", "exclaim", "shakeLight", 12, 480), serious: cue("g", null, "nod", 12, 480),
      closed: cue("h"), wry: cue("i", "sweatdrop"), flustered: cue("j", "blush", "waver", 8, 760),
      displeased: cue("k", "anger"), confident: cue("l", null, "nod", 12, 510),
      confused: cue("m", "question"), panicked: cue("n", "sweat", "shakeLight", 16, 530),
    },
    specials: { ">_<": cue(">_<", "sweat", "shakeLight", 16, 530) },
  },
  eustice: {
    direction: "端着架子的优等生：节拍短而明确；受用但不蹦跳，窘迫先僵住再轻抖。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", "sparkle", "nod", 15, 470),
      sad: cue("d", "gloom"), angry: cue("e", "anger", "nod", 22, 410),
      surprised: cue("f", "exclaim", "shakeLight", 14, 420), serious: cue("g", null, "nod", 12, 420),
      closed: cue("h"), wry: cue("i", "ellipsis"), flustered: cue("j", "blush", "shakeLight", 12, 450),
      displeased: cue("k", "anger", "nod", 12, 420), confident: cue("l", "glitter", "nod", 15, 450),
      confused: cue("m", "question"), panicked: cue("n", "sweat", "shakeLight", 18, 490),
    },
  },
  kororo: {
    direction: "慵懒天才：动作拖半拍，闭目可打盹；认真时收掉懒散，兴奋也只轻轻起伏。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", "note", "nod", 15, 740),
      sad: cue("d", "gloom"), angry: cue("e", "anger"), surprised: cue("f", "exclaim", "shakeLight", 12, 520),
      serious: cue("g"), closed: cue("h", "sleepy"), wry: cue("i", "note"),
      flustered: cue("j", "blush", "waver", 8, 780), displeased: cue("k", "ellipsis"),
      confident: cue("l", "idea"), confused: cue("m", "question"), panicked: cue("n", "sweat", "shakeLight", 16, 550),
    },
    specials: { wink: cue("wink", "sparkle", "nod", 12, 650) },
  },
  lenore: {
    direction: "寡言带刺：不悦压成低气压，坦率善意才令她轻晃；讲读时沉静可靠。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", null, "nod", 8, 650),
      sad: cue("d", "gloom"), angry: cue("e", "gloom"), surprised: cue("f", "exclaim", "shakeLight", 12, 510),
      serious: cue("g"), closed: cue("h"), wry: cue("i", "ellipsis"),
      flustered: cue("j", "blush", "waver", 8, 760), displeased: cue("k", "gloom"),
      confident: cue("l", null, "nod", 10, 550), confused: cue("m", "question"),
      panicked: cue("n", "sweat", "shakeLight", 16, 580),
    },
  },
  marietta: {
    direction: "无机质女仆长：静止本身是压迫；吃瘪用短暂无言，微笑与闭目保持体面。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", null, "nod", 8, 620),
      sad: cue("d"), angry: cue("e"), surprised: cue("f", "ellipsis"), serious: cue("g"),
      closed: cue("h"), wry: cue("i"), flustered: cue("j", "ellipsis"), displeased: cue("k", "ellipsis"),
      confident: cue("l", null, "nod", 8, 560), confused: cue("m", "question"), panicked: cue("n", "ellipsis"),
    },
  },
  norma: {
    direction: "街头斥候：灵活、短促、带坏笑；得手轻跃，失手流一滴汗就收住。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", "note", "jump", 76, 680),
      sad: cue("d", "gloom"), angry: cue("e", "anger", "shakeLight", 12, 400),
      surprised: cue("f", "exclaim", "shakeLight", 16, 410), serious: cue("g"), closed: cue("h"),
      wry: cue("i", "sparkle", "nod", 12, 430), flustered: cue("j", "sweatdrop", "shakeLight", 12, 440),
      displeased: cue("k", "sweatdrop"), confident: cue("l", "idea", "nod", 15, 430),
      confused: cue("m", "question"), panicked: cue("n", "sweat", "shakeLight", 20, 490),
    },
  },
  tibby: {
    direction: "活泼精明的商人：喜悦与得意更外放，亏本时明显吃瘪；动量仍限制在立绘尺度。",
    cues: {
      neutral: cue("a"), smile: cue("b", null, "nod", 15, 450), joy: cue("c", "note", "jump", 84, 700),
      sad: cue("d", "gloom", "waver", 10, 700), angry: cue("e", "anger", "nod", 20, 410),
      surprised: cue("f", "exclaim", "jump", 52, 620), serious: cue("g"), closed: cue("h"),
      wry: cue("i", "sparkle", "nod", 15, 460), flustered: cue("j", "sweatdrop", "waver", 10, 620),
      displeased: cue("k", "gloom"), confident: cue("l", "glitter", "nod", 18, 430),
      confused: cue("m", "question"), panicked: cue("n", "sweat", "shakeLight", 20, 530),
    },
    specials: { "smiling-eyes": cue("smiling-eyes", "glitter", "nod", 15, 500) },
  },
  vivienne: {
    direction: "贵妇与策士：得意华丽但不跳跃，恼怒保持端稳；失去掌控时才轻微失衡。",
    cues: {
      neutral: cue("a"), smile: cue("b"), joy: cue("c", "glitter", "nod", 10, 640),
      sad: cue("d", "gloom"), angry: cue("e"), surprised: cue("f", "exclaim"),
      serious: cue("g"), closed: cue("h"), wry: cue("i", "sparkle", "nod", 10, 580),
      flustered: cue("j", "sweatdrop"), displeased: cue("k", "ellipsis"), confident: cue("l", "glitter"),
      confused: cue("m", "question"), panicked: cue("n", "sweatdrop", "waver", 6, 670),
    },
  },
};
