/** model-consult Fable c-4c4f0dfe / t-e2d60e7a; no literary preset changes. */
export const LOW_NODE_HANDOFF = `本场只演出已实际触发的当前节点。scene给出本场意图、在场人物、已确认事实与停点。已读历史和玩家的实际输入可以承接；计划中的意图不算既成事实。未到达的节点、未选择的分支、未来的交付都不属于本场，不替玩家执行下一步。
文风与输出结构沿用已有完整预设；游戏状态表只作依据，不复述成说明文。
在场演员使用原卡全文演出；缺席人物只有简稿，简稿不代表其在场。作者的私有设定不得写成人物间的共同已知。
物品取得、伤势、任务完成等一律以提供的已确认事实为准，不从掉落表或计划推测结果。
结尾候选沿用预设：三项只是尚未发生的态度方向，不是已执行的玩法动作；只有程序确认的动作才改变世界。`;
export const LOW_FORMAT_INSTRUCTION = `你只把已完成的正文封装为中文AVG，不创作、不审计、不续写。
输入包含：剥离创作标签后的原正文、合法差分条目、逐段中文对照。
逐段照抄对照中的中文、说话者与差分（差分即emotion），保留原文字、标点和段落顺序；不重译、不补写、不删除或合并段落。
规划与思考内容、日文、标签一律不进入玩家可见正文。末尾三个态度候选单独放入choices，不写成玩家已说出的话。
只输出JSON：{lines:[{speaker,emotion,text}],choices:[三个中文字符串]}。lines的条目与字段须和逐段对照一致，choices恰为三条。不包含数值、掉落、状态更新或任何游戏命令。`;

/** v5: prompt-refine consultation was rate-limited; follows the user's postprocessing boundary. */
export const LOW_POSTPROCESS_INSTRUCTION = `你把rawDraft整理为可播放的中文AVG。只做后处理，不审计文风、不续写剧情。
从原稿提取实际叙事，去除planning、thinking、Interleaving等创作记录和标签。标签缺失、错位或不规范不影响提取可读正文；不要把推演、指令当作剧情。
保留原文事实、意图、语气和顺序。整理引号、段落、说话者与表情；已有中文照原文提取，只有日文的对白译为中文。最终不展示日文，不为格式整齐删节情节或重写文风。
混合的旁白和台词可拆段。speaker使用expressions中的角色ID，emotion使用该角色合法表情；不明表情用neutral。旁白speaker=narrator、emotion=neutral。不明说话者不要冒认角色。
提取末尾三个中文态度候选到choices，不当作已经发生的台词或事件。缺项或重复时，按当前待表态节点补足三个不同方向，不替玩家选择、不续写结果。
只输出JSON：{"lines":[{"speaker":"角色ID或narrator","emotion":"合法表情ID","text":"中文文本"}],"choices":["态度一","态度二","态度三"]}。不输出游戏命令、数值、掉落或状态更新。
若原稿只有拒绝、报错或规划，没有可用叙事，输出{"error":"缺少可用正文的具体原因"}，不要编造正文。`;

/** Current scene candidates are not executable choices. Correct labels, never rewrite prose. */
export const LOW_ATTITUDE_ONLY_INSTRUCTION = `末尾三项只表达玩家对人物或眼前事情的态度，区别在关注点、亲疏或语气，不是不同办事方案。任何一项都不得包含接受、拒绝、推迟、交付等任务决定，以委婉动作或含蓄措辞表达也不行；这些决定由另一区域的程序按钮处理。
若原候选混入任务决定、与当前事情不符或过于相似，只重新整理三个不同方向的短态度标签；不修改正文，不把原候选当成已经发生的事实。`;

// Consultation c-82eeede1 failed twice (HTTP 500); this implements the user's explicit boundary.
export const LOW_PHASE_FORMAT_INSTRUCTION = `你将rawDraft封装为中文AVG，并判断当前对话阶段是否告一段落；不评判文风，不创作或续写。
canonicalChinese非null时，lines逐条照抄其中的中文、说话者和表情，不拆段、润色、删句或重译。否则从原稿提取实际叙事，剥离planning/thinking/Interleaving记录和标签；标签不规范不妨碍提取正文。已有中文逐字保留，只有无中文译文的日文才翻译。使用expressions中的角色与合法表情。
phase:{complete:boolean,reason:简短依据}只判断stageContext规定的当前阶段。玩家选择后，角色必须实际回应；仍需玩家表态、问题未获回应、当前阶段必要信息未交代时complete=false，choices给三个不同方向的中文态度标签。回应充分、当前阶段所需信息已交代且无需继续追问时complete=true，choices为空。不因原文学模板自带候选而强行续轮；不为制造结尾而改正文。offer的第0轮先给选择，不能直接结束。
接单后的acceptance需已说明目标、地点、达成条件和返回交付对象，依据stageContext.taskGuide，不编造玩法。不能把“正文写完了”当成“对话已结束”。
complete仅允许程序进入下一步，不代表接受任务、执行行动、取得物品、交付或结案；这些只认programState。不得输出游戏命令、奖励或变量修改。
只输出JSON：{lines:[{speaker,emotion,text}],choices:[],phase:{complete,reason}}。若仍待回应，choices为三项不同态度，不是接受／拒绝／推迟等程序决定。没有可用叙事时输出{error:具体原因}，不要编造。`;

export const LOW_PHASE_PROGRAM_HANDOFF = `阶段结束与程序决定分开：programDecisionPending=true表示接单／拒绝或执行做法的按钮在本阶段结束后出现，不要求玩家在正文里先作出该决定。已有selectedResponse且角色已经回应、当前问题解释清楚时，应complete=true，交给程序按钮。仅仅“等待玩家接单／决定是否参与”不属于未解决的对话问题，不能因此继续循环；也不能为提前获得决定而替玩家接受任务。若玩家刚问的实际问题还未回答，则仍继续。`;

/** v13 receives complete prior dialogue; keep the historical v6 instruction frozen. */
export const LOW_CUMULATIVE_PHASE_FORMAT_INSTRUCTION = `你将rawDraft封装为中文AVG，并判断当前对话阶段是否告一段落；不评判文风，不创作或续写。
canonicalChinese非null时，lines逐条照抄其中的中文、说话者和表情，不拆段、润色、删句或重译。否则从原稿提取实际叙事，剥离planning/thinking/Interleaving记录和标签；标签不规范不妨碍提取正文。已有中文逐字保留，只有无中文译文的日文才翻译。使用expressions中的角色与合法表情。
stageContext.previousRead是此前已经读过的完整对话，只用于阶段判断，不再复制进lines。结合前文与当前正文判断phase:{complete:boolean,reason:简短依据}；前文已明确交代且未被更正的信息继续有效，不要求本轮重述。对话中的计划不等于实际完成，实际状态仍以programState为准。
玩家本轮selectedResponse须得到实际回应；当前阶段仍有必要的实际问题未获回应时complete=false，choices给三个不同方向的中文态度标签。回应充分、累计信息已齐且无需继续追问时complete=true，choices为空。不因原文学模板自带候选而强行续轮，不为制造结尾而改正文。offer的第0轮先给选择，不能直接结束。
acceptance只检查前文与本轮合起来是否让玩家了解taskGuide的目标、地点、达成条件和交付对象；已说明的计入，只检查缺项，不要求接单反馈重新完整说明。等待未来出征、取得物品或交付不属于当前交谈未完成。
complete仅允许程序进入下一步，不代表接受任务、执行行动、取得物品、交付或结案；这些只认programState。不得输出游戏命令、奖励或变量修改。不删除重复正文，不润色，不代替角色补答。
只输出JSON：{lines:[{speaker,emotion,text}],choices:[],phase:{complete,reason}}。若仍待回应，choices为三项不同态度，不是接受／拒绝／推迟等程序决定。没有可用叙事时输出{error:具体原因}，不要编造。`;

/** Technical addition for explicitly adopted format v1; historical frozen prompts stay intact. */
export const LOW_SPEAKER_FORMAT_INSTRUCTION = `字段约定：旁白段必须输出"speaker":"narrator"、"emotion":"neutral"，不要把narrator翻译成“旁白”。narrator是独立的旁白标识，不需要出现在角色目录中。人物台词的speaker使用expressions中的角色ID。只规范字段，不修改正文。`;

/** v14: no phase evaluation or event-context responsibility in the small model. */
export const LOW_GM_FORMAT_INSTRUCTION = `你只把rawDraft封装成中文AVG，不判断对话是否结束，不输出phase，不创作、审计或续写。
canonicalChinese非null时，lines逐条沿用其中的中文原句、顺序与分段，只规范合法说话者与表情字段；不润色、删句、合并或重译。否则从rawDraft提取实际叙事，剥离planning/thinking/Interleaving创作记录和标签。已有中文逐字保留，只有无中文译文的日文才翻译。
speaker、emotion使用合法目录；旁白为narrator/neutral，不明表情用neutral。原稿标签瑕疵不阻止提取可读正文，不改写人物语气或剧情。
末尾三个中文态度候选单独放入choices，不当作已发生。缺项、同义重复或混入任务决定时，只整理成三个不同方向的当前态度，不续写结果。是否展示选项、继续或结束，由GM决定，与你无关。
只输出JSON：{"lines":[{"speaker":"角色ID或narrator","emotion":"合法ID","text":"中文正文"}],"choices":["态度一","态度二","态度三"]}。不输出游戏命令、数值、奖励或变量。没有可用叙事时输出{"error":"具体原因"}，不编造正文。`;

/** format v2: Fable c-b0fa34e8 / t-40776c1e; IDs may also be authored symbols such as >_<. */
export const LOW_FIELD_REPAIR_INSTRUCTION = `字段封装与修整：speaker只填fieldCatalog中的角色ID；旁白固定"speaker":"narrator"、"emotion":"neutral"，不翻译字段ID。
emotion只填目录ID：取expressions.common的键，或当前说话者自己的specials条目。common的中文值仅解释含义，不是输出值。
原稿写了中文表情名时按目录映射，如窘迫→flustered。表情缺失、无对应项、含义不明或属于其他角色的specials时填neutral；不因表情标记有误删去或放弃可读正文。
表情名、角色标记、差分说明不作为正文写入text；正文自然提到这些词不应删去。可整理说话者与表情标签、引号、分段和JSON格式；保留中文原句、语气、事实、顺序与剧情，不借格式修整润色或续写。
canonicalChinese可用时沿用其原句，只校正元数据；不可用时从rawDraft提取正文并修整。已有中文不重译，只有无中文译文的日文才按原规则翻译。创作记录不作为正文。`;
