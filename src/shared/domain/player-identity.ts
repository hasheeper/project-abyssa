/**
 * The protagonist keeps the historical `kael` key for saves, dice ownership,
 * formation rules and asset lookup. Authored text must use the token instead of
 * turning that compatibility key into a fixed player name.
 */
export const PLAYER_ACTOR_ID = "kael" as const;
export const PLAYER_NAME_TOKEN = "{{user}}" as const;
export const DEFAULT_PLAYER_NAME = "你" as const;

export function isPlayerActor(id: string | null | undefined): id is typeof PLAYER_ACTOR_ID {
  return id === PLAYER_ACTOR_ID;
}

export function playerDisplayName(name?: string | null): string {
  const value = name?.trim();
  return value && value !== PLAYER_NAME_TOKEN ? value : DEFAULT_PLAYER_NAME;
}

/** Resolve authored copy at the final presentation boundary. */
export function resolvePlayerText(text: string, name?: string | null): string {
  return text.replaceAll(PLAYER_NAME_TOKEN, playerDisplayName(name));
}
