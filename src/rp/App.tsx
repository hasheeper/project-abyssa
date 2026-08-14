import { useCallback, useEffect, useState } from "react";
import { RpScene } from "../components/RpScene";
import { Stage } from "../stage";
import { ACTORS, TRANSCRIPT } from "./transcript";

const background = import.meta.env.DEV
  ? "/src/assets/bg/shop.png"
  : "../src/assets/bg/shop.png";

/** 自动播放时每条停留多久。整条一次性出现,靠 CSS 淡入,不再逐字。 */
const AUTO_MS = 2200;

export function App() {
  const [count, setCount] = useState(1);
  const [auto, setAuto] = useState(false);

  const advance = useCallback(() => {
    setCount((value) => Math.min(value + 1, TRANSCRIPT.length));
  }, []);

  const restart = useCallback(() => {
    setCount(1);
    setAuto(false);
  }, []);

  useEffect(() => {
    if (!auto || count >= TRANSCRIPT.length) return;
    const timer = window.setTimeout(advance, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [auto, count, advance]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  const messages = TRANSCRIPT.slice(0, count);
  const ended = count >= TRANSCRIPT.length;

  return (
    <Stage background="var(--abyssa-rp-backdrop)">
      <main className="rp-app">
        <header className="rp-app__toolbar">
          <div className="rp-app__title">
            <p>ABYSSA UI · SPLIT-SCREEN RP</p>
            <h1>跑团 / AI RP 界面</h1>
          </div>
          <nav className="rp-app__actions" aria-label="播放控制">
            <button type="button" onClick={advance} disabled={ended}>
              下一条
            </button>
            <button type="button" data-active={auto} onClick={() => setAuto((value) => !value)} disabled={ended}>
              自动播放
            </button>
            <button type="button" onClick={restart}>
              重新开始
            </button>
          </nav>
        </header>

        <section className="rp-app__stage" aria-label="分屏 RP 预览">
          <RpScene actors={ACTORS} messages={messages} background={background} />
        </section>

        <footer className="rp-app__hint">空格 / 回车 推进 ｜ 滚轮向上回看历史</footer>
      </main>
    </Stage>
  );
}
