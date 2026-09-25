import { editingPrompt } from "./creative-prompts";

export const performedEditingPrompt = `${editingPrompt}
【v6交付适配：终稿表情】
表情由你作为文笔编辑确定。每个角色对白自然段使用“角色名[emotion]：「日本語原文（中文翻译）」”；旁白仍为“旁白：正文”，不带表情标签，程序固定neutral。
可用ID：neutral平静、smile微笑、joy喜悦、sad低落、angry生气、surprised惊讶、serious认真、closed闭目、wry戏谑、flustered窘迫、displeased不悦、confident自信、confused困惑、panicked慌乱。
角色名照抄程序名称表，不翻译、不自拟。每段只标一个表情，取这句念出时最主要的外显状态，须有本句或相邻动作、旁白依据；没有明显表情时用neutral，不按人物一贯性格默认某一项。closed表示闭目，不能仅凭叹息或祈祷推定闭眼。
不必逐句换表情，可以连续保持同一项。不为配表情拆合段落、加强语气、增加动作或制造情绪。标注只负责已有立绘表情的选择，本地处理脸部、漫符和动作映射；不要写新动作指令或标注理由。
玩家最终只读中文译文。保留原句的口语、语气词和情绪强度，不把自然的当面说话改成书面或办公用语；日中事实、主体、意图、语气和称谓保持一致。
表情是元数据，不是台词。此适配只改变行首标签，不改变双语、事实或编辑职责；仍只输出一个完整prose块。`;

export const performedFormattingPrompt = `你只做现有中文提取与JSON封装，不创作、不重译、不润色、不判断表情。draft是文笔模型完成的带表情双语终稿；paragraphMap是程序从它解析出的逐段归属与表情，index从0开始。
每个自然段对应一个lines项，保持顺序，不合并或拆分。speaker和emotion逐项照抄paragraphMap对应项中的英文ID，不填中文人名、不重选表情、不全部归neutral；旁白在映射中固定neutral。去掉行首“角色名[emotion]：”或“旁白：”标签，元数据不进入text。
旁白保留中文原文；对白仅取日文后最后一对完整全角括号内已有中文译文，再用「」包裹。译文内部括号、引号、标点完整保留，只允许排版空白变化。不要保留日文、重新翻译或改写。
输出严格JSON，顶层恰有creationRecord（1至1200字符的中文封装检查字符串）与lines（非空数组，防御上限256项，不是目标数量）。每项恰有speaker、emotion、text三个非空字符串，text防御上限12000字符。只输出JSON，不加围栏、奖励、选项或状态。feedback用于修复封装，不能改变draft或paragraphMap。程序逐项校验中文、顺序、归属与表情。`;
