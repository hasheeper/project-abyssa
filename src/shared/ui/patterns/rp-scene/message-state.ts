import type { ExpressionId } from "../expressions";
import type { RpMessage } from "../rp-stage";

export type RpSayMessage = Extract<RpMessage, { kind: "say" }>;

/** chapter 是结构分隔；其余非对白消息是对白附近的功能气泡。 */
const AUX_KINDS = new Set<RpMessage["kind"]>(["narration", "roll", "system"]);

function isAux(message: RpMessage) {
  return AUX_KINDS.has(message.kind);
}

export function findCurrentSay(messages: readonly RpMessage[]): RpSayMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === "say") return message;
  }
  return undefined;
}

/**
 * 返回与最后一条对白同一叙事拍的功能气泡。
 * 优先取对白下方紧邻的连续段；没有下方段时取上方连续段。
 */
export function deriveLitAux(messages: readonly RpMessage[]) {
  const lit = new Set<string>();
  let anchor = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].kind === "say") {
      anchor = index;
      break;
    }
  }

  const hasAnchor = anchor !== -1;
  if (hasAnchor) {
    for (let index = anchor + 1; index < messages.length; index += 1) {
      const message = messages[index];
      if (!isAux(message)) break;
      lit.add(message.id);
    }
    if (lit.size > 0) return lit;
  }

  for (let index = hasAnchor ? anchor - 1 : messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isAux(message)) break;
    lit.add(message.id);
  }

  return lit;
}

/** 每个角色沿用最近一次明确指定的发言表情。 */
export function deriveExpressionByActor(messages: readonly RpMessage[]) {
  const expressionByActor = new Map<string, ExpressionId>();
  for (const message of messages) {
    if (message.kind === "say" && message.expression) {
      expressionByActor.set(message.actorId, message.expression);
    }
  }
  return expressionByActor;
}
