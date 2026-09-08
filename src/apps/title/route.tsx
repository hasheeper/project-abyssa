import { TitlePage } from "./TitlePage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
/* 各应用按所有权挑选样式表，所以用到的共享样式必须在这里显式引入 ——
   改公共 index.css 到不了这儿。
   logo.css 提供 AbyssaLogo 的中文/问号字族与部件过渡,缺了字标会掉字形。 */
import "../../shared/ui/styles/logo.css";
import "../../shared/stage/stage.css";
import "../../game-client/game-client.css";
import "./title.css";

export async function prepare() {
  const [{ TITLE_CG_FRAMES }, { loadImage }] = await Promise.all([import("./titleCg"), import("../../shared/loading/images")]);
  // 两列轮播共用解码结果，不挂载额外的立绘或整页。
  for (let i = 0; i < TITLE_CG_FRAMES.length; i += 2) {
    await Promise.all(TITLE_CG_FRAMES.slice(i, i + 2).map(frame => loadImage(frame.src)));
  }
}

export default function Page() {
  return (
    <>
      <TitlePage />
    </>
  );
}
