import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/*
 * 机械转轮读数。
 *
 * 视觉完全由 expedition.css 既有的 .abyssa-expedition-odometer__* 承担
 * （轮盘 55px 行高、三行数字条、逐位延迟、settle 落位），此处只负责
 * 把数值拆位并驱动位移。
 *
 * 位移是累计的：9→0 继续向前滚，绝不倒卷。
 */

/*
 * 行高由 CSS 变量 --odometer-digit-h 单一来源提供，
 * 位移用 calc 表达，因此改 CSS 尺寸时无需同步改 JS。
 */
const STRIP_CYCLES = 3;
const SPIN_DURATION = 760;
const DIGIT_STAGGER = 70;

/** 单个轮盘：累计位移，跨 9→0 时继续向前 */
function Reel({
  digit,
  order,
  dim
}: {
  digit: number;
  order: number;
  dim: boolean;
}) {
  const [position, setPosition] = useState(digit);
  const previousRef = useRef(digit);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous === digit) return;
    previousRef.current = digit;

    /* 只向前：算出到目标位的正向步数 */
    const forward = (digit - previous + 10) % 10;
    setPosition((current) => {
      const next = current + forward;
      /* 回落到第一循环，避免位移无限增长 */
      return next >= STRIP_CYCLES * 10 ? next % 10 : next;
    });
  }, [digit]);

  const style = {
    transform: `translateY(calc(var(--odometer-digit-h) * ${-position}))`,
    transition: `transform ${SPIN_DURATION}ms cubic-bezier(.12, .72, .18, 1)`,
    transitionDelay: `${order * DIGIT_STAGGER}ms`
  } as CSSProperties;

  return (
    <span
      className="abyssa-expedition-odometer__reel"
      data-order={Math.min(order, 4)}
      data-dim={dim || undefined}
    >
      <span className="abyssa-expedition-odometer__strip" style={style}>
        {Array.from({ length: STRIP_CYCLES * 10 }, (_, index) => {
          const numeral = index % 10;
          return numeral === digit ? (
            <b key={index}>{numeral}</b>
          ) : (
            <i key={index}>{numeral}</i>
          );
        })}
      </span>
    </span>
  );
}

type OdometerProps = {
  value: number;
  /** 整数位数；不足前置补位，补位轮压暗 */
  digits?: number;
  /** 小数位数（倍率读数用 ×12.40） */
  decimals?: number;
  prefix?: string;
  className?: string;
  label?: string;
};

type Cell =
  | { kind: "digit"; digit: number; dim: boolean }
  | { kind: "point" };

function buildCells(value: number, digits: number, decimals: number): Cell[] {
  const scaled = Math.max(0, Math.round(value * 10 ** decimals));
  const total = digits + decimals;
  const numerals = [...String(scaled).padStart(total, "0").slice(-total)].map(Number);

  /* 前导零压暗；整数个位永不压暗 */
  let firstSignificant = numerals.findIndex(
    (numeral, index) => numeral !== 0 || index >= digits - 1
  );
  if (firstSignificant < 0) firstSignificant = digits - 1;

  const cells: Cell[] = [];
  numerals.forEach((digit, index) => {
    if (decimals > 0 && index === digits) cells.push({ kind: "point" });
    cells.push({ kind: "digit", digit, dim: index < firstSignificant });
  });
  return cells;
}

export function ExpeditionOdometer({
  value,
  digits = 5,
  decimals = 0,
  prefix,
  className,
  label
}: OdometerProps) {
  const cells = buildCells(value, digits, decimals);
  const readout = decimals > 0 ? value.toFixed(decimals) : String(Math.max(0, Math.floor(value)));

  return (
    <output
      className={["abyssa-expedition-odometer", className].filter(Boolean).join(" ")}
      aria-label={label ?? `${prefix ?? ""}${readout}`}
    >
      <i className="abyssa-expedition-odometer__screw" data-side="left" aria-hidden="true" />
      {prefix && (
        <span className="abyssa-expedition-odometer__prefix" aria-hidden="true">
          {prefix}
        </span>
      )}
      <span className="abyssa-expedition-odometer__reels" aria-hidden="true">
        {cells.map((cell, index) =>
          cell.kind === "point" ? (
            <span className="abyssa-expedition-odometer__point" key={`point-${index}`} />
          ) : (
            <Reel digit={cell.digit} order={index} dim={cell.dim} key={index} />
          )
        )}
      </span>
      <i className="abyssa-expedition-odometer__screw" data-side="right" aria-hidden="true" />
    </output>
  );
}

/**
 * 已存入包裹的金额：数值入袋时立即滚动一次。
 * 层清后可能直接离场，不可等待一个并不存在的下一回合再刷新。
 */
export function ExpeditionBagOdometer({
  value,
  className,
  label
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const [shown, setShown] = useState(value);
  const [banking, setBanking] = useState(false);
  const timerRef = useRef<number | null>(null);

  /* 清层入袋时立即刷新；Reel 自己负责从旧数字向前滚到新数字。 */
  useEffect(() => {
    if (value === shown) return;

    setBanking(true);
    setShown(value);

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setBanking(false);
      timerRef.current = null;
    }, SPIN_DURATION + DIGIT_STAGGER * 5 + 260);
  }, [value, shown]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <span
      className={["abyssa-expedition-bag-odometer", className].filter(Boolean).join(" ")}
      data-banking={banking || undefined}
    >
      <ExpeditionOdometer value={shown} digits={6} label={label} />
    </span>
  );
}
