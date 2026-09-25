/** Deliberately conspicuous mock editorial text, never an accepted story fact. */
export const editorialFixture = "拟态废案：EDITORIAL_ONLY_不可进入故事或记忆。\n本音矫正／定稿录入：仅校准角色声音。\n语言协议锁：日文原句（中文翻译）。";
export const writingEnvelope = (prose: string, editorial = editorialFixture) => `<planning>\n${editorial}\n</planning>\n<prose>\n${prose}\n</prose>`;
/** Current v5 wire fixture; these are mock literary outputs, not quality evidence. */
export const creationEnvelope = (bodies: [string, string, string]) => `<Interleaving>\n${bodies.map((body, i) => `<thinking>CREATION_RECORD_ONLY_${i}</thinking>\n${body}`).join("\n")}\n</Interleaving>`;
