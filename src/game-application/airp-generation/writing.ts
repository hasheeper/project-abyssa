import { bytes, check, LIMITS } from "./contracts";
import { readEditedOutput, usesCreativeProtocol } from "./creative-output";

/** Versioned wire reader: raw evidence stays intact; only prose travels downstream. */
export function readWritingOutput(output: string, resourceVersion: number): { editorial: string | null; prose: string } {
  if (usesCreativeProtocol(resourceVersion)) return readEditedOutput(output);
  if (resourceVersion < 4) return { editorial: null, prose: output };
  check(bytes(output) <= LIMITS.responseBytes, "正文响应超过2 MiB，未截断原文。", "invalid-writing");
  const match = /^\s*<planning>\s*([\s\S]*?)\s*<\/planning>\s*<prose>\s*([\s\S]*?)\s*<\/prose>\s*$/.exec(output);
  check(match && match[1].trim() && match[2].trim(), "正文响应须包含独立、非空的planning创作记录和prose终稿。", "invalid-writing");
  check(!/<\/?(?:planning|prose)\b/i.test(match[1] + match[2]), "正文响应区块重复、嵌套或未闭合，未猜测或截取正文。", "invalid-writing");
  validateBilingualProse(match[2]);
  return { editorial: match[1], prose: match[2] };
}

/** Explicit A/B experiment contract, not a fallback for persisted resource-v4 runs. */
export function readProseOnlyWritingOutput(output: string): { editorial: null; prose: string } {
  check(bytes(output) <= LIMITS.responseBytes, "正文响应超过2 MiB，未截断原文。", "invalid-writing");
  const match = /^\s*<prose>\s*([\s\S]*?)\s*<\/prose>\s*$/.exec(output);
  check(match && match[1].trim(), "无Plan试验版须只包含一个非空、闭合的prose终稿区块。", "invalid-writing");
  check(!/<\/?(?:planning|prose)\b/i.test(match[1]), "无Plan试验版不得输出planning或重复、嵌套的prose区块。", "invalid-writing");
  validateBilingualProse(match[1]);
  return { editorial: null, prose: match[1] };
}

function validateBilingualProse(prose: string): void {
  for (const paragraph of prose.split(/\r?\n/).filter(line => line.trim())) {
    const labelled = /^\s*(旁白|艾洛拉)[:：]\s*(.*)$/.exec(paragraph);
    const text = (labelled?.[2] ?? paragraph).trim();
    if (labelled?.[1] === "艾洛拉" || text.startsWith("「")) {
      const bilingual = /^「([^「」\r\n]+)（([^「」\r\n]+)）」$/.exec(text);
      check(bilingual && bilingual[1].trim() && bilingual[2].trim(), "正文对白须逐句为「日本語原文（中文翻译）」；译文不能缺失或放在引号外，未交给格式化补写。", "invalid-writing");
    }
  }
}
