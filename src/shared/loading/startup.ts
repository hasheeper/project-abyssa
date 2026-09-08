import "../../assets/fonts/game-fonts.css";
import { prepareResources, readAssetManifest, type LoadProgress } from './resources';

async function prepareFonts() {
  if (!document.fonts) return;
  // Parse every local subset before entering the game, including glyphs not used by the title.
  // Four at a time keeps native font decoding bounded on slower devices.
  const faces = [...document.fonts].filter(face => /Cinzel|Noto Serif SC/.test(face.family));
  let cursor = 0;
  await Promise.all(Array.from({length: 4}, async () => { while (cursor < faces.length) await faces[cursor++].load(); }));
  await document.fonts.ready;
}

/** The resource/font barrier is shared by the entire document. Failed attempts can retry. */
let startup: Promise<void> | undefined;
export function prepareGame(onProgress: (progress: LoadProgress) => void): Promise<void> {
  return startup ??= (async () => {
    await prepareResources(await readAssetManifest(), onProgress);
    await prepareFonts();
  })().catch(error => { startup = undefined; throw error; });
}
