/** Deliberately never carries an upstream response body, URL, headers or key. */
export class LlmError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
    this.details = details;
  }
  toJSON() { return {code: this.code, message: this.message, ...this.details}; }
}
export function requireValue(condition, message, code = 'CONFIG') {
  if (!condition) throw new LlmError(code, message);
}
export function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function onlyKeys(value, keys, label, code = 'CONFIG') {
  requireValue(plainObject(value), `${label} must be an object.`, code);
  requireValue(Object.keys(value).every(key => keys.includes(key)), `${label} contains unsupported fields.`, code);
}
export function publicError(error) {
  if (['ENOENT','EACCES','ENOTDIR','EISDIR'].includes(error?.code)) return {code:'FILE',message:'Unable to read a local input. Check file paths and permissions.'};
  if (typeof error?.code === 'string' && error.code.startsWith('ERR_PARSE_ARGS')) return {code:'CLI',message:'Invalid command-line options. Use --help.'};
  return error instanceof LlmError ? error.toJSON() : {code: 'INTERNAL', message: 'Operation failed; inspect local inputs and configuration.'};
}
