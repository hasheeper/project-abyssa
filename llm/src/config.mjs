import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {LlmError, onlyKeys, plainObject, requireValue} from './errors.mjs';

export const llmRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultConfigPath = resolve(llmRoot, 'config/providers.local.json');
export const defaultSecretsPath = resolve(llmRoot, 'secrets/keys.local.json');
export const formats = ['oai', 'oai-res', 'anthropic', 'google'];
const auths = ['bearer', 'x-api-key', 'x-goog-api-key', 'none'];
const profileKeys = ['format','baseUrl','model','secretKey','apiKeyEnv','auth','outputTokenField','anthropicVersion','maxOutputTokens','maxInputChars','timeoutMs','maxRetries','temperature','topP'];

export async function readJson(path) {
  let data;
  try { data = await readFile(path, 'utf8'); }
  catch { throw new LlmError('FILE', 'Unable to read the requested JSON file.'); }
  try { return JSON.parse(data); }
  catch { throw new LlmError('JSON', 'Invalid JSON file.'); }
}
export function validateProfile(p, ready = true) {
  onlyKeys(p, profileKeys, 'Profile');
  requireValue(formats.includes(p.format), 'Unknown API format.');
  requireValue(typeof p.baseUrl === 'string' && typeof p.model === 'string', 'baseUrl and model must be strings.');
  if (ready) requireValue(p.baseUrl.trim() && p.model.trim(), 'Fill baseUrl and model before calling this profile.');
  if (p.baseUrl) {
    let u; try { u = new URL(p.baseUrl); } catch { throw new LlmError('CONFIG', 'Invalid baseUrl.'); }
    requireValue(!u.username && !u.password && !u.search && !u.hash, 'baseUrl must not contain credentials, query parameters or fragments.');
    requireValue(u.protocol === 'https:' || u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname), 'Use HTTPS, or HTTP for a local proxy.');
    requireValue(!/\/(chat\/completions|responses|messages)$|:generateContent$/.test(u.pathname), 'baseUrl is a versioned API root, not a complete operation endpoint.');
  }
  requireValue(!p.model || p.model.length <= 256 && /^[\w.:/+-]+$/.test(p.model), 'Invalid model identifier.');
  for (const field of ['secretKey','apiKeyEnv']) if (p[field] !== undefined) requireValue(typeof p[field] === 'string' && /^[A-Za-z0-9_.-]+$/.test(p[field]), `Invalid ${field} reference.`);
  requireValue(p.auth === undefined || auths.includes(p.auth), 'Invalid authentication format.');
  requireValue(p.outputTokenField === undefined || p.format === 'oai' && ['max_tokens','max_completion_tokens'].includes(p.outputTokenField), 'outputTokenField only applies to oai.');
  requireValue(p.anthropicVersion === undefined || p.format === 'anthropic' && /^\d{4}-\d{2}-\d{2}$/.test(p.anthropicVersion), 'Invalid anthropicVersion.');
  for (const [field, min, max] of [['maxOutputTokens',1,131072],['maxInputChars',100,2000000],['timeoutMs',100,600000],['maxRetries',0,3]]) {
    if (p[field] !== undefined) requireValue(Number.isInteger(p[field]) && p[field] >= min && p[field] <= max, `Invalid ${field}.`);
  }
  for (const [field,max] of [['temperature',2],['topP',1]]) if (p[field] !== undefined) requireValue(Number.isFinite(p[field]) && p[field] >= 0 && p[field] <= max, `Invalid ${field}.`);
  requireValue(p.format !== 'anthropic' || p.temperature === undefined || p.temperature <= 1, 'Anthropic temperature must be at most 1.');
  return {...p, auth: p.auth ?? (p.format === 'google' ? 'x-goog-api-key' : p.format === 'anthropic' ? 'x-api-key' : 'bearer'), maxOutputTokens:p.maxOutputTokens ?? 8192, maxInputChars:p.maxInputChars ?? 120000, timeoutMs:p.timeoutMs ?? 120000, maxRetries:p.maxRetries ?? 1};
}
export async function loadConfig(path = defaultConfigPath) {
  const c = await readJson(path);
  onlyKeys(c, ['schemaVersion','defaultProfile','profiles','server'], 'Configuration');
  requireValue(c.schemaVersion === 1, 'Unsupported configuration version.');
  requireValue(plainObject(c.profiles) && Object.keys(c.profiles).length > 0, 'Profiles are required.');
  requireValue(Object.keys(c.profiles).every(k => /^[a-zA-Z0-9_.-]+$/.test(k)), 'Invalid profile identifier.');
  requireValue(typeof c.defaultProfile === 'string' && Object.hasOwn(c.profiles, c.defaultProfile), 'Invalid default profile.');
  for (const p of Object.values(c.profiles)) validateProfile(p, false);
  const server = c.server ?? {};
  onlyKeys(server, ['port','tokenEnv','allowedOrigins'], 'Server');
  requireValue(server.port === undefined || Number.isInteger(server.port) && server.port >= 1024 && server.port <= 65535, 'Invalid server port.');
  requireValue(server.tokenEnv === undefined || typeof server.tokenEnv === 'string' && /^[A-Z0-9_]+$/.test(server.tokenEnv), 'Invalid server token environment variable.');
  requireValue(server.allowedOrigins === undefined || Array.isArray(server.allowedOrigins) && server.allowedOrigins.every(o => {
    try {const u = new URL(o); return u.origin === o && ['https:','http:'].includes(u.protocol);} catch {return false;}
  }), 'allowedOrigins must contain exact HTTP origins.');
  return c;
}
export async function loadSecrets(path = defaultSecretsPath) {
  let s;
  try {s = JSON.parse(await readFile(path, 'utf8'));}
  catch (error) {
    if (error.code === 'ENOENT') return {schemaVersion:1,keys:{},serverToken:''};
    throw new LlmError('SECRETS', 'Unable to read secrets; check the separate local secrets file.');
  }
  onlyKeys(s, ['schemaVersion','keys','serverToken'], 'Secrets');
  requireValue(s.schemaVersion === 1 && plainObject(s.keys) && Object.values(s.keys).every(k => typeof k === 'string' && !/[\r\n]/.test(k)), 'Invalid secrets format.');
  requireValue(s.serverToken === undefined || typeof s.serverToken === 'string', 'Invalid server token.');
  return s;
}
export function selectProfile(config, name = config.defaultProfile) {
  requireValue(Object.hasOwn(config.profiles, name), 'Profile does not exist.');
  return validateProfile(config.profiles[name]);
}
export function resolveKey(profile, secrets, env = process.env) {
  if (profile.auth === 'none') return '';
  const key = (profile.apiKeyEnv && env[profile.apiKeyEnv]) || secrets.keys[profile.secretKey] || '';
  requireValue(typeof key === 'string' && key.trim().length > 0 && !/[\r\n]/.test(key), 'Missing API key. Fill the separate secrets file or referenced environment variable.', 'AUTH_CONFIG');
  return key.trim();
}
