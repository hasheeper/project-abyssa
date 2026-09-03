export type Side = "player" | "opponent";
export type Phase =
  | "initial-roll"
  | "betting-one"
  | "public-lock"
  | "forced-reroll"
  | "private-lock"
  | "final-reroll"
  | "betting-two"
  | "showdown"
  | "settled";
export type MoodKey = keyof typeof MOODS;
export type BetAction = "check" | "call" | "raise-small" | "raise-big" | "fold";
export type HandCategory = "high" | "pair" | "twoPair" | "threeKind" | "smallStraight" | "fullHouse" | "fourKind" | "largeStraight" | "yacht";

export interface Rotation { x: number; y: number; }

export interface SideState {
  dice: number[];
  publicLocked: boolean[];
  privateLocked: boolean[];
  rolling: boolean[];
  rollDurations: number[];
  rotations: Rotation[];
}

export interface BettingState {
  street: 1 | 2;
  actor: Side;
  currentBet: number;
  streetContribution: Record<Side, number>;
  checks: number;
  raiseUsed: boolean;
  lastAction: { side: Side; action: BetAction; amount: number } | null;
}

export interface GameState {
  handNumber: number;
  dealer: Side;
  phase: Phase;
  turn: Side;
  busy: boolean;
  pot: number;
  bankroll: Record<Side, number>;
  contribution: Record<Side, number>;
  betting: BettingState | null;
  player: SideState;
  opponent: SideState;
  folded: Side | null;
  winner: Side | "tie" | null;
  lumenPriorityWinner: Side | null;
  settledPot: number;
  showdownRevealed: boolean;
}

export interface HandRank {
  category: HandCategory;
  name: string;
  english: string;
  rank: number;
  tiebreakers: number[];
}

export interface BetResolution {
  streetComplete: boolean;
  folded: boolean;
  paid: number;
}

export interface BetOptions {
  toCall: number;
  smallIncrement: number;
  bigIncrement: number;
  canCheck: boolean;
  canCall: boolean;
  canRaiseSmall: boolean;
  canRaiseBig: boolean;
}

const FACE_ROTATIONS: Record<number, readonly [number, number]> = {
  1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180]
};

export const PIP_POSITIONS: Record<number, string[]> = {
  1: ["mc"],
  2: ["tl", "br"],
  3: ["tl", "mc", "br"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "mc", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"]
};

export const MOODS = {
  calm: { expression: "calm" },
  thinking: { expression: "calm" },
  amused: { expression: "amused" },
  curious: { expression: "amused" },
  surprised: { expression: "surprised" },
  serious: { expression: "serious" }
} as const;

export const DIALOGUE = {
  intro: [
    "一局定胜负。你看到自己的骰子，我只看你愿意公开的部分~",
    "底注已经放好了。现在开始猜猜看，谁先心虚呢~"
  ],
  ante: ["二十枚和十枚，正好够让运气开始营业。", "底池已经准备好了哦~ 后悔要趁下注以前。"],
  playerBet: ["勇者大人先说话。过牌，还是让底池更有分量呢~"],
  tibbyThinking: ["呼唔……让我算算这句话值多少里拉。", "骰子不会说谎。下注的人就不一定了~"],
  tibbyCheck: ["我过牌。只是暂时不收你的钱哦~", "先看看吧。免费的耐心并不常见呢~"],
  tibbyCall: ["跟了。这点里拉还吓不到龙哦~", "好呀，我就陪你看到下一步。"],
  tibbySmallBet: ["先放一点。太安静的底池很无聊呢~", "小小加一点，看看勇者大人的表情。"],
  tibbyBigBet: ["那就让这句话贵一点吧。", "这么好的机会，只下小注太浪费了呢~"],
  tibbyRaise: ["还不够哦。想看下去，就再付一点吧~", "勇气不错。那我替它加个价。"],
  tibbyFold: ["这局让给你。至于我拿到了什么……不告诉你~", "好吧，这一池归你。别因此误会自己看穿我了哦~"],
  playerFold: ["弃牌呀~ 明智和胆小，有时候长得很像。", "底池归我。你的暗骰就继续保密吧~"],
  publicLock: ["公开锁定就是一句不能收回的话。选好了再告诉我哦~", "让我看看，你愿意公开多少诚意。"],
  publicLockNone: ["一枚都不公开？很会藏呢~", "全都重投。勇者大人对起手牌真没感情。"],
  publicLockSome: ["记住了。公开出来的骰子可不能反悔。", "这就是你愿意让我看到的部分呀~"],
  darkRoll: ["剩下的骰子会在暗处重投。我们都只能看见自己的结果。", "接下来是秘密时间哦~"],
  privateLock: ["现在锁住的骰子不会再公开。留下它们，或者再赌一次。", "最后一次重掷机会。别让贪心替你做决定哦~"],
  secondBet: ["最后一轮下注。现在每一句话都可能是假的。", "公开信息已经到此为止。要不要继续付钱看答案呢~"],
  showdown: ["那么，开牌吧。", "账目可以骗人，摊开的骰子不行哦~"],
  playerWin: ["是你赢了。这一池归勇者大人。", "看起来这次被你读到了呢~ 下次可不会这么便宜。"],
  opponentWin: ["多谢惠顾~ 底池和你的勇气，我都收下了。", "是我赢了。看来你的诈唬还需要一点保养费呢~"],
  draw: ["一样的牌。底池平分，谁也别想多拿一枚。", "平局呀~ 至少这次没有人能加价。"]
} as const;

const HAND_LABELS: Record<HandCategory, { name: string; english: string; rank: number }> = {
  high: { name: "散牌", english: "HIGH DICE", rank: 0 },
  pair: { name: "一对", english: "ONE PAIR", rank: 1 },
  twoPair: { name: "两对", english: "TWO PAIR", rank: 2 },
  threeKind: { name: "三条", english: "THREE OF A KIND", rank: 3 },
  smallStraight: { name: "小顺", english: "SMALL STRAIGHT", rank: 4 },
  fullHouse: { name: "葫芦", english: "FULL HOUSE", rank: 5 },
  fourKind: { name: "四条", english: "FOUR OF A KIND", rank: 6 },
  largeStraight: { name: "大顺", english: "LARGE STRAIGHT", rank: 7 },
  yacht: { name: "快艇", english: "YACHT", rank: 8 }
};

const STRAIGHT_RUNS = [
  [1, 2, 3, 4],
  [2, 3, 4, 5],
  [3, 4, 5, 6]
] as const;

function findSmallStraightRun(dice: readonly number[]) {
  const values = new Set(dice);
  return [...STRAIGHT_RUNS].reverse().find(run => run.every(value => values.has(value))) ?? null;
}

function lockStraightRun(dice: readonly number[], run: readonly number[], alreadyLocked: readonly boolean[] = []) {
  const needed = new Set(run);
  return dice.map((value, index) => {
    if (alreadyLocked[index]) {
      needed.delete(value);
      return true;
    }
    if (!needed.has(value)) return false;
    needed.delete(value);
    return true;
  });
}

export function randomItem(items: readonly string[]) {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

export function randomDie() {
  return 1 + Math.floor(Math.random() * 6);
}

function countDice(dice: number[]) {
  return dice.reduce<Record<number, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function rankHand(dice: number[]): HandRank {
  const counts = countDice(dice);
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const values = [...dice].sort((a, b) => b - a);
  const uniqueAsc = [...new Set(dice)].sort((a, b) => a - b);
  const largeStraightHigh = uniqueAsc.join("") === "12345" ? 5 : uniqueAsc.join("") === "23456" ? 6 : 0;
  const smallStraightRun = largeStraightHigh ? null : findSmallStraightRun(dice);
  let category: HandCategory;
  let tiebreakers: number[];

  if (groups[0]?.count === 5) {
    category = "yacht"; tiebreakers = [groups[0].value];
  } else if (largeStraightHigh) {
    category = "largeStraight"; tiebreakers = [largeStraightHigh];
  } else if (groups[0]?.count === 4) {
    category = "fourKind"; tiebreakers = [groups[0].value, groups[1]!.value];
  } else if (groups[0]?.count === 3 && groups[1]?.count === 2) {
    category = "fullHouse"; tiebreakers = [groups[0].value, groups[1].value];
  } else if (smallStraightRun) {
    const remainder = [...dice];
    smallStraightRun.forEach(value => remainder.splice(remainder.indexOf(value), 1));
    category = "smallStraight"; tiebreakers = [smallStraightRun.at(-1)!, ...remainder.sort((a, b) => b - a)];
  } else if (groups[0]?.count === 3) {
    category = "threeKind";
    tiebreakers = [groups[0].value, ...groups.slice(1).map(group => group.value).sort((a, b) => b - a)];
  } else if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    const pairs = groups.filter(group => group.count === 2).map(group => group.value).sort((a, b) => b - a);
    const kicker = groups.find(group => group.count === 1)!.value;
    category = "twoPair"; tiebreakers = [...pairs, kicker];
  } else if (groups[0]?.count === 2) {
    category = "pair";
    tiebreakers = [groups[0].value, ...groups.slice(1).map(group => group.value).sort((a, b) => b - a)];
  } else {
    category = "high"; tiebreakers = values;
  }

  return { category, ...HAND_LABELS[category], tiebreakers };
}

export function compareHands(left: number[], right: number[]) {
  const a = rankHand(left);
  const b = rankHand(right);
  if (a.rank !== b.rank) return Math.sign(a.rank - b.rank);
  const length = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a.tiebreakers[index] ?? 0) - (b.tiebreakers[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function otherSide(side: Side): Side {
  return side === "player" ? "opponent" : "player";
}

function createSide(dice: number[]): SideState {
  return {
    dice,
    publicLocked: [false, false, false, false, false],
    privateLocked: [false, false, false, false, false],
    rolling: [false, false, false, false, false],
    rollDurations: [0.9, 0.9, 0.9, 0.9, 0.9],
    rotations: dice.map(value => ({ x: FACE_ROTATIONS[value]![0], y: FACE_ROTATIONS[value]![1] }))
  };
}

function createHand(handNumber: number, dealer: Side, bankroll: Record<Side, number>): GameState {
  const nextBankroll = { ...bankroll };
  const playerAnte = Math.min(nextBankroll.player, dealer === "player" ? 10 : 20);
  const opponentAnte = Math.min(nextBankroll.opponent, dealer === "opponent" ? 10 : 20);
  nextBankroll.player -= playerAnte;
  nextBankroll.opponent -= opponentAnte;
  return {
    handNumber,
    dealer,
    phase: "initial-roll",
    turn: otherSide(dealer),
    busy: true,
    pot: playerAnte + opponentAnte,
    bankroll: nextBankroll,
    contribution: { player: playerAnte, opponent: opponentAnte },
    betting: null,
    player: createSide([1, 2, 3, 4, 5]),
    opponent: createSide([6, 5, 4, 3, 2]),
    folded: null,
    winner: null,
    lumenPriorityWinner: null,
    settledPot: 0,
    showdownRevealed: false
  };
}

export function createInitialGame() {
  return createHand(1, "opponent", { player: 500, opponent: 500 });
}

export function createNextHand(game: GameState) {
  return createHand(game.handNumber + 1, otherSide(game.dealer), game.bankroll);
}

export function cloneGame(game: GameState): GameState {
  const cloneSide = (side: SideState): SideState => ({
    ...side,
    dice: [...side.dice],
    publicLocked: [...side.publicLocked],
    privateLocked: [...side.privateLocked],
    rolling: [...side.rolling],
    rollDurations: [...side.rollDurations],
    rotations: side.rotations.map(rotation => ({ ...rotation }))
  });
  return {
    ...game,
    bankroll: { ...game.bankroll },
    contribution: { ...game.contribution },
    betting: game.betting ? {
      ...game.betting,
      streetContribution: { ...game.betting.streetContribution },
      lastAction: game.betting.lastAction ? { ...game.betting.lastAction } : null
    } : null,
    player: cloneSide(game.player),
    opponent: cloneSide(game.opponent)
  };
}

function countLocked(locks: readonly boolean[]) {
  return locks.filter(Boolean).length;
}

export function getFinalRerollLimit(side: Pick<SideState, "publicLocked" | "privateLocked">) {
  const publicCount = countLocked(side.publicLocked);
  if (publicCount === 0 || publicCount === side.publicLocked.length) return 0;
  const eligibleDice = side.publicLocked.reduce(
    (count, isPublic, index) => count + (!isPublic && !side.privateLocked[index] ? 1 : 0),
    0
  );
  return eligibleDice;
}

export function getLumenPriorityScore(side: Pick<SideState, "publicLocked">) {
  return countLocked(side.publicLocked);
}

export function compareLumenPriority(player: Pick<SideState, "publicLocked">, opponent: Pick<SideState, "publicLocked">) {
  return Math.sign(getLumenPriorityScore(player) - getLumenPriorityScore(opponent));
}

export function chooseLimitedRerollMask(dice: readonly number[], eligible: readonly boolean[], limit: number) {
  const selected = dice
    .map((value, index) => ({ value, index }))
    .filter(({ index }) => eligible[index])
    .sort((left, right) => left.value - right.value || left.index - right.index)
    .slice(0, Math.max(0, limit));
  const indices = new Set(selected.map(({ index }) => index));
  return dice.map((_, index) => indices.has(index));
}

export function nextRotation(rotation: Rotation, value: number): Rotation {
  const [targetX, targetY] = FACE_ROTATIONS[value]!;
  const normalize = (number: number) => ((number % 360) + 360) % 360;
  return {
    x: rotation.x + (2 + Math.floor(Math.random() * 2)) * 360 + ((normalize(targetX) - normalize(rotation.x) + 360) % 360),
    y: rotation.y + (2 + Math.floor(Math.random() * 2)) * 360 + ((normalize(targetY) - normalize(rotation.y) + 360) % 360)
  };
}

export function getBettingOpener(game: Pick<GameState, "dealer" | "player" | "opponent">, street: 1 | 2): Side {
  if (street !== 2) return otherSide(game.dealer);
  const playerPublic = countLocked(game.player.publicLocked);
  const opponentPublic = countLocked(game.opponent.publicLocked);
  if (playerPublic !== opponentPublic) return playerPublic < opponentPublic ? "player" : "opponent";
  return otherSide(game.dealer);
}

export function startBetting(game: GameState, street: 1 | 2) {
  game.phase = street === 1 ? "betting-one" : "betting-two";
  game.turn = getBettingOpener(game, street);
  game.busy = false;
  game.betting = {
    street,
    actor: game.turn,
    currentBet: 0,
    streetContribution: { player: 0, opponent: 0 },
    checks: 0,
    raiseUsed: false,
    lastAction: null
  };
}

function roundedStake(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function getBetOptions(game: GameState, side: Side): BetOptions {
  const betting = game.betting;
  if (!betting || betting.actor !== side) {
    return { toCall: 0, smallIncrement: 0, bigIncrement: 0, canCheck: false, canCall: false, canRaiseSmall: false, canRaiseBig: false };
  }
  const toCall = Math.max(0, betting.currentBet - betting.streetContribution[side]);
  const smallIncrement = roundedStake(game.pot * 0.5);
  const bigIncrement = roundedStake(game.pot);
  const bankroll = game.bankroll[side];
  return {
    toCall,
    smallIncrement,
    bigIncrement,
    canCheck: toCall === 0,
    canCall: toCall > 0 && bankroll >= toCall,
    canRaiseSmall: !betting.raiseUsed && bankroll >= toCall + smallIncrement,
    canRaiseBig: !betting.raiseUsed && bankroll >= toCall + bigIncrement
  };
}

export function applyBetAction(game: GameState, side: Side, action: BetAction): BetResolution {
  const betting = game.betting;
  if (!betting || betting.actor !== side) return { streetComplete: false, folded: false, paid: 0 };
  const options = getBetOptions(game, side);
  const opponent = otherSide(side);
  if (action === "fold") {
    game.folded = side;
    game.winner = opponent;
    betting.lastAction = { side, action, amount: 0 };
    return { streetComplete: true, folded: true, paid: 0 };
  }
  if (action === "check") {
    if (!options.canCheck) return { streetComplete: false, folded: false, paid: 0 };
    betting.checks += 1;
    betting.lastAction = { side, action, amount: 0 };
    if (betting.checks >= 2) return { streetComplete: true, folded: false, paid: 0 };
    betting.actor = opponent;
    game.turn = opponent;
    return { streetComplete: false, folded: false, paid: 0 };
  }
  if (action === "call") {
    if (!options.canCall) return { streetComplete: false, folded: false, paid: 0 };
    const paid = options.toCall;
    game.bankroll[side] -= paid;
    game.pot += paid;
    game.contribution[side] += paid;
    betting.streetContribution[side] += paid;
    betting.lastAction = { side, action, amount: paid };
    return { streetComplete: true, folded: false, paid };
  }

  const increment = action === "raise-small" ? options.smallIncrement : options.bigIncrement;
  const allowed = action === "raise-small" ? options.canRaiseSmall : options.canRaiseBig;
  if (!allowed) return { streetComplete: false, folded: false, paid: 0 };
  const wasRaised = betting.currentBet > 0;
  const paid = options.toCall + increment;
  game.bankroll[side] -= paid;
  game.pot += paid;
  game.contribution[side] += paid;
  betting.streetContribution[side] += paid;
  betting.currentBet = betting.streetContribution[side];
  betting.raiseUsed ||= wasRaised;
  betting.checks = 0;
  betting.actor = opponent;
  betting.lastAction = { side, action, amount: paid };
  game.turn = opponent;
  return { streetComplete: false, folded: false, paid };
}

export function choosePublicLocks(dice: number[], random = Math.random) {
  const rank = rankHand(dice);
  const counts = countDice(dice);
  if (["largeStraight", "fullHouse", "yacht"].includes(rank.category)) return [true, true, true, true, true];
  if (rank.category === "smallStraight") return lockStraightRun(dice, findSmallStraightRun(dice)!);
  const bestCount = Math.max(...Object.values(counts));
  if (bestCount >= 2) {
    const target = Number(Object.entries(counts).filter(([, count]) => count === bestCount).sort((a, b) => Number(b[0]) - Number(a[0]))[0]![0]);
    const mask = dice.map(value => value === target);
    if (bestCount >= 3 && random() < 0.28) {
      let hidden = false;
      return mask.map(value => value && !hidden ? (hidden = true, false) : value);
    }
    return mask;
  }
  if (random() < 0.34) return [false, false, false, false, false];
  const high = Math.max(...dice);
  let used = false;
  return dice.map(value => value === high && !used ? (used = true, true) : false);
}

export function choosePrivateLocks(dice: number[], alreadyLocked: boolean[]) {
  const counts = countDice(dice);
  const rank = rankHand(dice);
  if (["largeStraight", "fullHouse", "fourKind", "yacht"].includes(rank.category)) return [true, true, true, true, true];
  if (rank.category === "smallStraight") return lockStraightRun(dice, findSmallStraightRun(dice)!, alreadyLocked);
  const bestCount = Math.max(...Object.values(counts));
  if (bestCount >= 2) {
    const target = Number(Object.entries(counts).filter(([, count]) => count === bestCount).sort((a, b) => Number(b[0]) - Number(a[0]))[0]![0]);
    return dice.map((value, index) => alreadyLocked[index] || value === target);
  }
  return [...alreadyLocked];
}

export interface AiBetContext {
  ownDice: number[];
  playerPublicDice: number[];
  pot: number;
  toCall: number;
  canRaiseSmall: boolean;
  canRaiseBig: boolean;
  bankroll: number;
  street: 1 | 2;
  random?: () => number;
}

export function chooseOpponentBet(context: AiBetContext): BetAction {
  const random = context.random ?? Math.random;
  const strength = rankHand(context.ownDice).rank;
  const publicThreat = context.playerPublicDice.length >= 3 ? rankHand([...context.playerPublicDice, ...Array(5 - context.playerPublicDice.length).fill(1)]).rank : 0;
  const roll = random();
  if (context.toCall > 0) {
    if (strength >= 5 && context.canRaiseBig && roll > 0.2) return "raise-big";
    if (strength >= 3 && context.canRaiseSmall && roll > 0.45) return "raise-small";
    if (strength >= 2 || context.toCall <= context.pot * 0.3 || roll < 0.2) return "call";
    if (publicThreat >= 3 && strength < 2) return "fold";
    return roll < 0.42 ? "call" : "fold";
  }
  if (strength >= 5) return context.canRaiseBig ? "raise-big" : context.canRaiseSmall ? "raise-small" : "check";
  if (strength >= 3) return context.canRaiseSmall && roll > 0.25 ? "raise-small" : "check";
  if (strength >= 1) return context.canRaiseSmall && roll > 0.62 ? "raise-small" : "check";
  return context.canRaiseSmall && roll < (context.street === 2 ? 0.18 : 0.12) ? "raise-small" : "check";
}
