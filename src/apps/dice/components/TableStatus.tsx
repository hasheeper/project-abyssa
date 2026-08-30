import type { CSSProperties } from "react";
import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";
import type { Side } from "../game";

export interface CoinTransfer {
  id: number;
  side: Side;
  amount: number;
}

interface TableStatusProps {
  phaseLabel: string;
  pot: number;
  actionText: string;
  transfer?: CoinTransfer | null;
}

type CoinMetal = "gold" | "silver" | "copper";

const COIN_VALUE = 5;
const MAX_TABLE_COINS = 18;
const MAX_TRANSFER_COINS = MAX_TABLE_COINS;
const METAL_SEQUENCE: CoinMetal[] = ["copper", "silver", "copper", "gold", "silver", "copper"];
const COIN_CLUSTER_X = [-53, -28, -4, 23, 49];
const COIN_CLUSTER_Y = [5, -2, 4, -4, 3];
const COIN_CLUSTER_SEQUENCE = [2, 1, 2, 3, 1, 4, 2, 0, 3, 1, 4, 2, 0, 3, 2, 4, 1, 0];

function seededFraction(index: number, salt: number) {
  const value = Math.sin((index + 1) * (12.9898 + salt * 7.233)) * 43758.5453;
  return value - Math.floor(value);
}

function coinStyle(index: number, sequenceIndex = index) {
  const cluster = COIN_CLUSTER_SEQUENCE[index % COIN_CLUSTER_SEQUENCE.length]!;
  let level = 0;
  for (let previous = 0; previous < index; previous += 1) {
    if (COIN_CLUSTER_SEQUENCE[previous % COIN_CLUSTER_SEQUENCE.length] === cluster) level += 1;
  }
  const jitterX = (seededFraction(index, 1) - .5) * 9;
  const jitterY = (seededFraction(index, 2) - .5) * 5;
  const rotation = -18 + seededFraction(index, 3) * 36;
  const scale = .94 + seededFraction(index, 4) * .1;
  return {
    "--coin-index": index,
    "--coin-sequence": sequenceIndex,
    "--coin-x": `${COIN_CLUSTER_X[cluster]! + jitterX + (level % 2) * 1.8}px`,
    "--coin-y": `${COIN_CLUSTER_Y[cluster]! + jitterY - level * 2.3}px`,
    "--coin-rotate": `${rotation}deg`,
    "--coin-scale": scale
  } as CSSProperties;
}

function TableCoin({ index, sequenceIndex, incoming = false }: { index: number; sequenceIndex?: number; incoming?: boolean }) {
  const metal = METAL_SEQUENCE[index % METAL_SEQUENCE.length]!;
  return (
    <i
      className={`table-coin ${incoming ? "table-coin--incoming" : "table-coin--stacked"}`}
      data-metal={metal}
      style={coinStyle(index, sequenceIndex)}
      aria-hidden="true"
    >
      <span data-part="rim" />
      <span data-part="crest" />
      <span data-part="shine" />
    </i>
  );
}

function IncomingCoins({ side, count, startIndex, persistent, eventKey }: { side: Side; count: number; startIndex: number; persistent: boolean; eventKey: string | number }) {
  if (count <= 0) return null;
  return (
    <div key={eventKey} className="table-status__incoming-coins" data-side={side} data-persistent={persistent ? "true" : "false"} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <TableCoin key={index} index={startIndex + index} sequenceIndex={index} incoming />)}
    </div>
  );
}

export function TableStatus({ phaseLabel, pot, actionText, transfer }: TableStatusProps) {
  const countCoins = (value: number) => value > 0 ? Math.min(MAX_TABLE_COINS, Math.ceil(value / COIN_VALUE)) : 0;
  const coinCount = countCoins(pot);
  const previousCoinCount = transfer ? countCoins(Math.max(0, pot - transfer.amount)) : 0;
  const addedCoinCount = Math.max(0, coinCount - previousCoinCount);
  const overflowTransferCount = transfer?.amount && addedCoinCount === 0
    ? Math.min(6, Math.max(1, Math.ceil(transfer.amount / COIN_VALUE)))
    : 0;
  const transferCount = Math.min(MAX_TRANSFER_COINS, addedCoinCount || overflowTransferCount);
  const transferPersists = addedCoinCount > 0;
  const settledCoinCount = transfer ? (transferPersists ? previousCoinCount : coinCount) : 0;
  const openingOpponentCount = transfer ? 0 : Math.ceil(coinCount / 2);
  const openingPlayerCount = transfer ? 0 : Math.floor(coinCount / 2);
  const transferStartIndex = transferPersists ? settledCoinCount : Math.max(0, coinCount - transferCount);

  return (
    <section className="table-status" aria-label="木桌赌局状态">
      <span className="table-status__wood" aria-hidden="true" />
      <div className="table-status__surface">
        <header className="table-status__phase">
          <span className="table-status__phase-frame" aria-hidden="true" />
          <small>当前阶段</small>
          <span className="table-status__phase-divider" aria-hidden="true" />
          <strong>{phaseLabel}</strong>
        </header>

        <div className="table-status__coin-field" data-coin-count={coinCount} aria-label={`场上 ${coinCount} 枚钱币`}>
          <div className="table-status__coin-pile">
            {Array.from({ length: settledCoinCount }, (_, index) => <TableCoin key={index} index={index} />)}
          </div>
          {transfer ? (
            <IncomingCoins side={transfer.side} count={transferCount} startIndex={transferStartIndex} persistent={transferPersists} eventKey={transfer.id} />
          ) : (
            <>
              <IncomingCoins side="opponent" count={openingOpponentCount} startIndex={0} persistent eventKey="opening-opponent" />
              <IncomingCoins side="player" count={openingPlayerCount} startIndex={openingOpponentCount} persistent eventKey="opening-player" />
            </>
          )}
        </div>

        <div className="table-status__pot">
          <span className="table-status__pot-frame" aria-hidden="true" />
          <small>底池</small>
          <span className="table-status__pot-divider" aria-hidden="true" />
          <CurrencyAmount value={pot} label={`底池 ${pot}`} />
        </div>

        <span className="table-status__action">{actionText}</span>
      </div>
    </section>
  );
}
