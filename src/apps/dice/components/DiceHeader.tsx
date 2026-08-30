import { RpgHeader } from "../../../shared/ui/primitives/RpgHeader";

export function DiceHeader() {
  return (
    <RpgHeader
      className="game-header dice-header__title"
      label="Light & Shadow Dice"
      description="明暗骰"
      watermark={{ size: 36, innerInset: 9 }}
    />
  );
}
