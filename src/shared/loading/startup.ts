import "../../assets/fonts/game-fonts.css";
import { prepareResources, readAssetManifest } from './resources';

async function prepareFonts() {
  if (!document.fonts) return;
  // FontFaceSet.load selects only the unicode-range subsets needed by the first screen.
  // Do not iterate every face or wait for unrelated fonts requested elsewhere.
  await Promise.all([
    document.fonts.load('600 16px "Cinzel"', 'ABYSSA0123456789'),
    document.fonts.load('400 16px "Noto Serif SC"', '正在准备旅程即将开始继续游戏新的开始记录设定正在读取档案尚未有存档选择或开启。…'),
  ]);
}

/** Only critical fonts gate boot; current-route code/art are prepared alongside this. */
let startup: Promise<void> | undefined;
export function prepareGame(): Promise<void> {
  return startup ??= prepareFonts().catch(error => { startup = undefined; throw error; });
}

let background: Promise<void> | undefined;
/** Called after the current page can reveal. Failure never blocks play; later visits retry.
 * Keep the complete-release cache for offline use, without decoding off-screen images/fonts. */
export function warmGameResources(): Promise<void> {
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
  if (connection?.saveData) return Promise.resolve();
  return background ??= (async () => {
    const manifest = await readAssetManifest();
    await prepareResources(manifest, () => {}, {background: true});
  })().catch(error => {
    background = undefined;
    console.warn('[ABYSSA background resources] 后续资源将在使用时重试。', error);
  });
}
