import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AvatarFrame } from "./AvatarFrame";

afterEach(cleanup);

const CSS = readFileSync(
  resolve(import.meta.dirname, "../styles/avatar-frame.css"),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

describe("AvatarFrame", () => {
  it("renders the frame art and an embedded photo", () => {
    const { container } = render(<AvatarFrame src="/a.png" />);

    expect(container.querySelector(".abyssa-avatar__art")).not.toBeNull();
    const img = container.querySelector(".abyssa-avatar__photo img");
    expect(img).toHaveAttribute("src", "/a.png");
  });

  it("falls back to the given placeholder when there is no image", () => {
    const { container } = render(<AvatarFrame fallback="尤" />);

    expect(container.querySelector(".abyssa-avatar__photo")?.textContent).toBe("尤");
    expect(container.querySelector("img")).toBeNull();
  });

  /* 素材不是方形头像时（例如只有全身立绘的角色），
     调用方要能自己取景，但仍用同一个框。 */
  it("lets callers supply their own framing inside the same frame", () => {
    const { container } = render(
      <AvatarFrame src="/ignored.png">
        <img src="/portrait.png" alt="" />
      </AvatarFrame>
    );

    const img = container.querySelector(".abyssa-avatar__photo img");
    expect(img).toHaveAttribute("src", "/portrait.png");
  });

  /* 形制是左上/右下切角的六边形 —— 与画框、菱形节点、骰面外框同属
     一套「切角」语汇。圆形头像是社交产品的语汇，放进这套
     木金 / 羊皮纸界面会立刻显廉价。 */
  it("clips the photo to the chamfered silhouette, never a circle", () => {
    const photo = CSS.match(/\.abyssa-avatar__photo\s*\{([^}]*)\}/)![1];

    expect(photo).toContain("clip-path: polygon(");
    expect(photo).not.toMatch(/border-radius:\s*50%/);
    /* 圆角矩形同样不行：切角是直边斜切，不是圆弧。 */
    expect(photo).not.toMatch(/border-radius:\s*\d/);
  });

  /* 照片要嵌进框里，不是贴在框上。内阴影必须落在 ::after ——
     写成父级的 box-shadow 会被 <img> 子元素盖住。 */
  it("sinks the photo into the frame with an inset shadow layer", () => {
    const overlay = CSS.match(/\.abyssa-avatar__photo::after\s*\{([^}]*)\}/)![1];
    expect(overlay).toMatch(/box-shadow:[\s\S]*inset/);
  });

  /* 五层描边全部走令牌，调用方换皮只改颜色不碰形状。 */
  it("drives every stroke from a themeable token", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./AvatarFrame.tsx"), "utf8");

    for (const token of ["fill", "frame", "middle", "deep", "ornament"]) {
      expect(source).toContain(`var(--abyssa-avatar-${token})`);
    }
    /* 不许把颜色写死在组件里。 */
    expect(source.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/stroke="#[0-9a-f]/i);
  });
});
