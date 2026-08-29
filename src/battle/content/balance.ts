export const MAX_HP = 3;
export const DOWNED_RETURN_HP = Math.max(1, Math.floor(MAX_HP / 2));
export const MAX_LAYER = 5;
export const REROLLS_PER_ROUND = 2;
export const LAYER_MULTIPLIERS = [1, 1.3, 1.7, 2.2, 3] as const;
export const STALL_GRACE_ROUNDS = 2;
export const FRENZY_ATTACK_BONUS = 3;
