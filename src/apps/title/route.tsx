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
import "./title-interaction.css";

export async function prepare() {
  const [{ TITLE_CG_FRAMES, TITLE_CG_RIGHT_OFFSET }, { loadImage }] = await Promise.all([import("./titleCg"), import("../../shared/loading/images")]);
  // 首屏只等待左右起始帧；后续帧由后台预读和 TitleCgPanel 的下一帧检查接力。
  await Promise.all([0, TITLE_CG_RIGHT_OFFSET].map(index => loadImage(TITLE_CG_FRAMES[index].src)));
}

export default function Page() {
  return (
    <>
      <TitlePage />
    </>
  );
}
