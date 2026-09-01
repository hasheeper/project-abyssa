import { useEffect, useMemo, useRef, useState } from "react";
import type { HandEvaluation, LayerSettlement } from "../engine";
import type { BattleUiSkin } from "../battleUiSkins";

const PARTY_LINK_SEGMENTS = 36;
const PARTY_LINK_FRAME_INTERVAL = 1000 / 30;

interface PartyLinkSample {
  pX: number;
  pY: number;
  nX: number;
  nY: number;
  damping: number;
  t: number;
}

function getPartyLinkSamples(): PartyLinkSample[] {
  const start = { x: 32, y: 90 };
  const end = { x: 32, y: 0 };
  const c1 = { x: 32, y: 60 };
  const c2 = { x: 32, y: 30 };

  return Array.from({ length: PARTY_LINK_SEGMENTS }, (_, index) => {
    const t = (index + 1) / PARTY_LINK_SEGMENTS;
    const mt = 1 - t;
    const pX = mt ** 3 * start.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x;
    const pY = mt ** 3 * start.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y;
    const dX = 3 * mt ** 2 * (c1.x - start.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t ** 2 * (end.x - c2.x);
    const dY = 3 * mt ** 2 * (c1.y - start.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t ** 2 * (end.y - c2.y);
    const length = Math.hypot(dX, dY) || 1;

    return { t, pX, pY, nX: -dY / length, nY: dX / length, damping: Math.sin(t * Math.PI) };
  });
}

function getAnimatedPartyLinkPath(
  samples: PartyLinkSample[],
  time: number,
  frequency: number,
  amplitude: number,
  speed: number,
  phase: number
) {
  let path = "M 32 90 ";
  samples.forEach((sample) => {
    const wave = Math.sin(sample.t * Math.PI * frequency + time * speed + phase);
    const offset = amplitude * sample.damping * wave;
    path += `L ${sample.pX + sample.nX * offset} ${sample.pY + sample.nY * offset} `;
  });
  return path;
}

export function AnimatedPartyLink({ active }: { active: boolean }) {
  const auraRef = useRef<SVGPathElement>(null);
  const mainRef = useRef<SVGPathElement>(null);
  const highRef = useRef<SVGPathElement>(null);
  const samples = useMemo(() => getPartyLinkSamples(), []);
  const staticPath = "M32 90 C32 60, 32 30, 32 0";

  useEffect(() => {
    const resetToStatic = () => {
      auraRef.current?.setAttribute("d", staticPath);
      mainRef.current?.setAttribute("d", staticPath);
      highRef.current?.setAttribute("d", staticPath);
    };

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || reducedMotion) {
      resetToStatic();
      return;
    }

    let frame = 0;
    let lastDraw = -PARTY_LINK_FRAME_INTERVAL;
    const draw = (time: number) => {
      if (time - lastDraw >= PARTY_LINK_FRAME_INTERVAL) {
        lastDraw = time;
        auraRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 1.5, 5, .0008, 0));
        mainRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 2.2, 3, .0016, Math.PI / 4));
        highRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 3.5, -2, .0022, Math.PI));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, samples]);

  return (
    <span className="abyssa-expedition-party-link" aria-hidden="true">
      <svg viewBox="0 0 64 90" preserveAspectRatio="none">
        <path className="abyssa-expedition-party-link__under" d={staticPath} />
        <path className="abyssa-expedition-party-link__aura" d={staticPath} ref={auraRef} />
        <path className="abyssa-expedition-party-link__main" d={staticPath} ref={mainRef} />
        <path className="abyssa-expedition-party-link__high" d={staticPath} ref={highRef} />
      </svg>
    </span>
  );
}

export function FrameRails() {
  return (
    <span className="abyssa-expedition-frame__rails" aria-hidden="true">
      <i data-edge="top" />
      <i data-edge="right" />
      <i data-edge="bottom" />
      <i data-edge="left" />
    </span>
  );
}

export function BattleFrameCorners({
  imageUrl,
  skin
}: {
  imageUrl: string;
  skin: BattleUiSkin;
}) {
  return (
    <span className="abyssa-expedition-frame__corner-ornaments" aria-hidden="true">
      {(["tl", "tr", "br", "bl"] as const).map((corner) => (
        <img
          key={`${skin}-${corner}`}
          src={imageUrl}
          alt=""
          data-corner={corner}
          draggable={false}
        />
      ))}
    </span>
  );
}

export function ExpeditionHandReadout({ hand }: { hand: HandEvaluation | null }) {
  const name = hand?.name ?? null;
  const bonus = hand?.adjustedBonus ?? 0;
  const scoring = Boolean(name) && name !== "散牌" && bonus > 0;
  const [pulseKey, setPulseKey] = useState(0);
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousRef.current === name) return;
    previousRef.current = name;
    setPulseKey((current) => current + 1);
  }, [name]);

  return (
    <output
      className="abyssa-expedition-hand"
      data-scoring={scoring || undefined}
      data-idle={!scoring || undefined}
      aria-label={scoring ? `当前牌型 ${name}，倍率 +${bonus}` : "当前无成牌"}
    >
      <span className="abyssa-expedition-hand__body" key={pulseKey}>
        <strong className="abyssa-expedition-hand__name">{name ?? "—"}</strong>
        <i className="abyssa-expedition-hand__rule" aria-hidden="true" />
        <span className="abyssa-expedition-hand__bonus">
          <i aria-hidden="true">×</i>
          <b>{scoring ? bonus.toFixed(1) : "—"}</b>
        </span>
      </span>
      <span className="abyssa-expedition-hand__glow" aria-hidden="true" />
    </output>
  );
}

export function LayerSettlementBreakdown({ settlement }: { settlement: LayerSettlement }) {
  const closingBonus = settlement.closingHandBonus;

  return (
    <section
      className="abyssa-expedition-modal__settlement"
      role="region"
      aria-label={
        `第 ${settlement.layer} 层结算：本层散金 ${settlement.baseGold} 金币，` +
        `乘牌型倍率 ${settlement.handFactor.toFixed(2)}，乘层倍率 ${settlement.layerFactor}，` +
        `本层入袋 ${settlement.payout} 金币`
      }
    >
      <div className="abyssa-expedition-modal__settlement-formula">
        <span data-currency="gold">
          <small>本层散金</small>
          <strong>{settlement.baseGold.toLocaleString()}G</strong>
        </span>
        <i aria-hidden="true">×</i>
        <span>
          <small>最终牌型</small>
          <strong>{settlement.handFactor.toFixed(2)}</strong>
        </span>
        <i aria-hidden="true">×</i>
        <span>
          <small>层倍率</small>
          <strong>{settlement.layerFactor}</strong>
        </span>
        <i aria-hidden="true">＝</i>
        <span data-currency="gold" data-result>
          <small>本层入袋</small>
          <strong>＋{settlement.payout.toLocaleString()}G</strong>
        </span>
      </div>
      <p data-counted={closingBonus > 0 || undefined}>
        {closingBonus > 0
          ? `最后回合【${settlement.closingHandName}】倍率 +${closingBonus.toFixed(2)}，已计入最终牌型倍率`
          : "最后回合没有新增牌型倍率"}
      </p>
      <footer>
        <span>包裹 {settlement.bagBefore.toLocaleString()}G</span>
        <i aria-hidden="true">→</i>
        <strong>{settlement.bagAfter.toLocaleString()}G</strong>
      </footer>
    </section>
  );
}
