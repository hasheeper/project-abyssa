const hidden = "[已隐藏]";
const secretField = "(?:authorization|proxy-authorization|x-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|cookie|set-cookie)";

/** Display-only defense for common credentials, not a general log sanitizer.
 * Hosts must omit request bodies, conversation text and other private context. */
export function redactErrorDetails(raw: string) {
  const text = raw
    // Quoted JSON/header maps, including escaped quotes inside the value.
    .replace(new RegExp(`(["']${secretField}["']\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`, "gi"), (_match, prefix: string, value: string) => `${prefix}${value[0]}${hidden}${value[0]}`)
    .replace(/^(\s*(?:authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie)\s*:\s*).*$/gim, `$1${hidden}`)
    // Inline proxy messages may prepend text before a header. Consume the
    // auth scheme and credential together before generic single-value fields.
    .replace(/(\b(?:authorization|proxy-authorization)\s*[=:]\s*)(?:Bearer|Basic)\s+[^\s&"'<>;,}\]]+/gi, `$1${hidden}`)
    .replace(new RegExp(`(\\b${secretField}\\b\\s*[=:]\\s*)(?!\\[已隐藏\\])([^\\s&"'<>;,}\\]]+)`, "gi"), `$1${hidden}`)
    .replace(/([?&](?:key|api_key|apikey|token|access_token|signature)=)[^&#\s"'<>]+/gi, `$1${hidden}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.\-]+/gi, `$1 ${hidden}`)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, hidden);
  return { text, redacted: text !== raw };
}
