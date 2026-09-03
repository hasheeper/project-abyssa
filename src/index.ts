import "./shared/ui/styles/index.css";

export { ABYSSA_LOGO_VIEW_BOXES, AbyssaLogo } from "./shared/ui/branding/AbyssaLogo";
export type {
  AbyssaLogoBackground,
  AbyssaLogoCrop,
  AbyssaLogoProps
} from "./shared/ui/branding/AbyssaLogo";
export {
  ABYSSA_LOGO_PART_LABELS,
  ABYSSA_LOGO_PARTS,
  DEFAULT_ABYSSA_LOGO_LAYOUT,
  cloneAbyssaLogoLayout,
  formatAbyssaLogoLayoutJson,
  formatAbyssaLogoLayoutTs,
  normalizeAbyssaLogoLayout,
  parseAbyssaLogoLayout
} from "./shared/ui/branding/abyssaLogoLayout";
export type {
  AbyssaLogoLayout,
  AbyssaLogoPartId,
  AbyssaLogoPartTransform
} from "./shared/ui/branding/abyssaLogoLayout";
export {
  ABYSSA_LOGO_INTRO_DURATION,
  ABYSSA_LOGO_INTRO_SEQUENCE,
  ABYSSA_LOGO_INTRO_TOTAL_MS,
  getAbyssaLogoIntroStep
} from "./shared/ui/branding/abyssaLogoIntro";
export type {
  AbyssaLogoIntroKind,
  AbyssaLogoIntroStep
} from "./shared/ui/branding/abyssaLogoIntro";

export { AbyssaProvider } from "./shared/ui/primitives/AbyssaProvider";
export type { AbyssaProviderProps } from "./shared/ui/primitives/AbyssaProvider";
export { ArrowButton } from "./shared/ui/primitives/ArrowButton";
export type { ArrowButtonProps } from "./shared/ui/primitives/ArrowButton";
export { BattleScreen } from "./shared/ui/patterns/BattleScreen";
export type {
  BattleAlly,
  BattleActionKind,
  BattleAttackEvent,
  BattleAttackMotionMode,
  BattleAttackPhase,
  BattleCommandId,
  BattleEnemy,
  BattleFloatingFeedback,
  BattleHolyAttackEvent,
  BattlePlacement,
  BattleScene,
  BattleScreenProps,
  BattleSpriteAdjustment,
  BattleSpritePose,
  BattleTurnEntry
} from "./shared/ui/patterns/BattleScreen";
export { CharacterSelector } from "./shared/ui/patterns/CharacterSelector";
export type {
  CharacterOption,
  CharacterSelectorProps
} from "./shared/ui/patterns/CharacterSelector";
export { CharacterPortraitSelector } from "./shared/ui/patterns/CharacterPortraitSelector";
export type {
  CharacterPortraitSelectorItem,
  CharacterPortraitSelectorProps
} from "./shared/ui/patterns/CharacterPortraitSelector";
export { CharacterStatusScreen } from "./shared/ui/patterns/CharacterStatusScreen";
export type {
  CharacterInterfaceTone,
  CharacterMenuItem,
  CharacterOutfit,
  CharacterProfile,
  CharacterTabRenderArgs,
  CharacterStatusScreenProps
} from "./shared/ui/patterns/CharacterStatusScreen";
export { CurrencyAmount } from "./shared/ui/primitives/CurrencyAmount";
export type { CurrencyAmountProps, CurrencyKind } from "./shared/ui/primitives/CurrencyAmount";
export { DiamondWatermark } from "./shared/ui/primitives/DiamondWatermark";
export type {
  DiamondWatermarkConfig,
  DiamondWatermarkOptions,
  DiamondWatermarkProps
} from "./shared/ui/primitives/DiamondWatermark";
export { IconButton } from "./shared/ui/primitives/IconButton";
export { RetroRpgIconButton } from "./shared/ui/primitives/IconButton";
export type {
  IconButtonIcon,
  IconButtonProps,
  IconButtonShape
} from "./shared/ui/primitives/IconButton";
export { InventoryDialog } from "./shared/ui/patterns/InventoryDialog";
export type {
  InventoryCategory,
  InventoryDialogProps
} from "./shared/ui/patterns/InventoryDialog";
export { InventoryGrid } from "./shared/ui/patterns/InventoryGrid";
export type { InventoryEntry, InventoryGridProps } from "./shared/ui/patterns/InventoryGrid";
export { ItemSlot, ItemSlotStatic } from "./shared/ui/primitives/ItemSlot";
export type {
  ItemSlotButtonProps,
  ItemSlotProps,
  ItemSlotStaticProps
} from "./shared/ui/primitives/ItemSlot";
export {
  DEFAULT_ITEM_RARITY,
  ITEM_RARITY_LABELS,
  ITEM_RARITY_ORDER,
  ITEM_RARITY_RANKS,
  itemRarityRank,
  normalizeItemRarity
} from "./shared/ui/items/rarity";
export type { ItemRarity } from "./shared/ui/items/rarity";
export { RpgModal } from "./shared/ui/primitives/RpgModal";
export type { RpgModalProps } from "./shared/ui/primitives/RpgModal";
export { Nameplate } from "./shared/ui/primitives/Nameplate";
export type { NameplateProps } from "./shared/ui/primitives/Nameplate";
export { Progress } from "./shared/ui/primitives/Progress";
export type { ProgressProps } from "./shared/ui/primitives/Progress";
export { RibbonButton } from "./shared/ui/primitives/RibbonButton";
export type { RibbonButtonProps } from "./shared/ui/primitives/RibbonButton";
export { RpgFrame } from "./shared/ui/primitives/RpgFrame";
export type { RpgFrameProps } from "./shared/ui/primitives/RpgFrame";
export {
  RetroRpgBackButton,
  RpgBackButton
} from "./shared/ui/primitives/RpgBackButton";
export type { RpgBackButtonProps } from "./shared/ui/primitives/RpgBackButton";
export {
  RetroRpgCheckbox,
  RetroRpgRadio,
  RpgCheckbox,
  RpgRadio
} from "./shared/ui/primitives/RpgChoice";
export type {
  RpgCheckboxProps,
  RpgCheckboxVariant,
  RpgRadioProps,
  RpgRadioVariant
} from "./shared/ui/primitives/RpgChoice";
export { RetroRpgHeader, RpgHeader } from "./shared/ui/primitives/RpgHeader";
export type {
  RetroRpgHeaderProps,
  RpgHeaderProps
} from "./shared/ui/primitives/RpgHeader";
export { RetroRpgDialogue, RpgDialogue } from "./shared/ui/primitives/RpgDialogue";
export type {
  RpgDialogueProps,
  RpgDialogueVariant
} from "./shared/ui/primitives/RpgDialogue";
export { PaperDoll } from "./shared/ui/patterns/PaperDoll";
export type { PaperDollProps } from "./shared/ui/patterns/PaperDoll";
export { RpScene } from "./shared/ui/patterns/RpScene";
export type {
  RpActor,
  RpMessage,
  RpSceneProps,
  RpSeat
} from "./shared/ui/patterns/RpScene";
export { VisualNovelScene } from "./shared/ui/patterns/VisualNovelScene";
export type {
  NovelActor,
  NovelLine,
  VisualNovelSceneProps
} from "./shared/ui/patterns/VisualNovelScene";
export {
  CHARACTER_EXPRESSIONS,
  EXPRESSION_LABELS,
  getExpressionParts,
  hasCharacter
} from "./shared/ui/patterns/expressions";
export type { ExpressionId, ExpressionParts } from "./shared/ui/patterns/expressions";
export { CHARACTER_CALIBRATION, getCalibration } from "./shared/ui/patterns/spriteCalibration";
export type { SpriteCalibration } from "./shared/ui/patterns/spriteCalibration";
export { Emote } from "./shared/ui/patterns/Emote";
export type { EmoteProps } from "./shared/ui/patterns/Emote";
export {
  EMOTES,
  EMOTE_ADJUST,
  EMOTE_IDS,
  EMOTE_LABELS,
  EMOTE_PLACEMENT,
  hasEmote,
  resolveEmotePlacement
} from "./shared/ui/patterns/emotes";
export type { EmoteAdjustTable, EmoteDef, EmotePlacement } from "./shared/ui/patterns/emotes";
export {
  IDLE_LABELS,
  MOTION_LABELS,
  jump,
  nod,
  playMotion,
  shakeHeavy,
  shakeLight,
  waver
} from "./shared/ui/patterns/motions";
export type { IdleId, MotionId, MotionSpec } from "./shared/ui/patterns/motions";
export {
  RetroRpgDirectionPad,
  RpgDirectionPad
} from "./shared/ui/primitives/RpgDirectionPad";
export type {
  RpgDirection,
  RpgDirectionPadProps
} from "./shared/ui/primitives/RpgDirectionPad";
export {
  RetroRpgHexButton,
  RpgHexButton
} from "./shared/ui/primitives/RpgHexButton";
export type {
  RetroRpgHexButtonProps,
  RpgHexButtonProps
} from "./shared/ui/primitives/RpgHexButton";
export {
  RetroRpgDiamondNode,
  RetroRpgDiamondNodeTrack,
  RpgDiamondNode,
  RpgDiamondNodeTrack
} from "./shared/ui/primitives/RpgDiamondNodeTrack";
export type {
  RpgDiamondNodeItem,
  RpgDiamondNodeProps,
  RpgDiamondNodeTrackOrientation,
  RpgDiamondNodeTrackProps,
  RpgDiamondNodeVariant
} from "./shared/ui/primitives/RpgDiamondNodeTrack";
export { RpgFacetDiamond } from "./shared/ui/primitives/RpgFacetDiamond";
export type {
  RpgFacetDiamondProps,
  RpgFacetDiamondState
} from "./shared/ui/primitives/RpgFacetDiamond";
export { RetroRpgNotchButton, RpgNotchButton } from "./shared/ui/primitives/RpgNotchButton";
export type { RpgNotchButtonProps } from "./shared/ui/primitives/RpgNotchButton";
export {
  RetroRpgNotchedPillButton,
  RpgNotchedPillButton
} from "./shared/ui/primitives/RpgNotchedPillButton";
export type { RpgNotchedPillButtonProps } from "./shared/ui/primitives/RpgNotchedPillButton";
export {
  RetroRpgCircleButton,
  RetroRpgShapeButton,
  RpgCircleButton,
  RpgShapeButton
} from "./shared/ui/primitives/RpgShapeButton";
export type {
  RpgCircleButtonProps,
  RpgShapeButtonProps,
  RpgShapeButtonShape
} from "./shared/ui/primitives/RpgShapeButton";
export { RetroRpgTab, RpgTab } from "./shared/ui/primitives/RpgTab";
export type { RpgTabProps, RpgTabVariant } from "./shared/ui/primitives/RpgTab";
export { RpgPanel } from "./shared/ui/primitives/RpgPanel";
export type { RpgPanelProps } from "./shared/ui/primitives/RpgPanel";
export {
  RetroRpgSquarePanel,
  RpgSquarePanel
} from "./shared/ui/primitives/RpgSquarePanel";
export type {
  RetroRpgSquarePanelProps,
  RpgSquarePanelProps
} from "./shared/ui/primitives/RpgSquarePanel";
export { RetroRpgStatusNode, RpgStatusNode } from "./shared/ui/primitives/RpgStatusNode";
export type {
  RpgStatusNodeIcon,
  RpgStatusNodeProps,
  RpgStatusNodeVariant
} from "./shared/ui/primitives/RpgStatusNode";
export { SectionHeader } from "./shared/ui/primitives/SectionHeader";
export type { SectionHeaderProps } from "./shared/ui/primitives/SectionHeader";
export { StatusPanel } from "./shared/ui/patterns/StatusPanel";
export type {
  StatusBond,
  StatusChip,
  StatusField,
  StatusPact,
  StatusPanelAffiliation,
  StatusPanelAffiliationTone,
  StatusPanelData,
  StatusPanelProps,
  StatusStat,
  StatusTrait
} from "./shared/ui/patterns/StatusPanel";
export { Toggle } from "./shared/ui/primitives/Toggle";
export type { ToggleProps } from "./shared/ui/primitives/Toggle";
export {
  RetroRpgVerticalIndicator,
  VerticalIndicator
} from "./shared/ui/primitives/VerticalIndicator";
export type { VerticalIndicatorProps } from "./shared/ui/primitives/VerticalIndicator";
export type { AbyssaSize, AbyssaVariant, PanelVariant } from "./shared/ui/types";
