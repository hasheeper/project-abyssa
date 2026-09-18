import type {Server} from 'node:http';
export type ApiFormat = 'oai' | 'oai-res' | 'anthropic' | 'google';
export type Message = {role:'system'|'user'|'assistant';content:string};
export interface TextRequest {
  messages:Message[];
  maxOutputTokens?:number;
  temperature?:number;
  topP?:number;
  stop?:string[];
}
export interface Profile {
  format:ApiFormat;
  baseUrl:string;
  model:string;
  secretKey?:string;
  apiKeyEnv?:string;
  auth?:'bearer'|'x-api-key'|'x-goog-api-key'|'none';
  outputTokenField?:'max_tokens'|'max_completion_tokens';
  anthropicVersion?:string;
  maxOutputTokens?:number;
  maxInputChars?:number;
  timeoutMs?:number;
  maxRetries?:number;
  temperature?:number;
  topP?:number;
}
export interface Config {
  schemaVersion:1;
  defaultProfile:string;
  profiles:Record<string,Profile>;
  server?:{port?:number;tokenEnv?:string;allowedOrigins?:string[]};
}
export interface Secrets {schemaVersion:1;keys:Record<string,string>;serverToken?:string}
export interface GenerationResult {
  text:string;
  complete:boolean;
  finishReason:string;
  usage:{inputTokens:number|null;outputTokens:number|null;totalTokens:number|null};
  id:string|null;
  model:string;
  format:ApiFormat;
  attempts:number;
  durationMs:number;
}
export function loadConfig(path?:string):Promise<Config>;
export function loadSecrets(path?:string):Promise<Secrets>;
export function selectProfile(config:Config,name?:string):Profile;
export function resolveKey(profile:Profile,secrets:Secrets,env?:Record<string,string|undefined>):string;
export function generate(options:{profile:Profile;apiKey?:string;request:TextRequest;signal?:AbortSignal;fetchImpl?:typeof fetch}):Promise<GenerationResult>;

export interface EditorialTask {
  schemaVersion:1;
  id:string;
  sceneId:string;
  actors:{id:string;name:string}[];
  contextActors:string[];
  player:{actorId:'kael';nameToken:'{{user}}';authoredSpeech:boolean};
  slots:{id:string;actorId:string;allowedEmotions:string[];[key:string]:unknown}[];
  outline:{sceneId:string;[key:string]:unknown}[];
  immutableBranches:unknown[];
  state:Record<string,unknown>;
  constraints:string[];
  revisionNotes?:string[];
  humanReview:{required:true;[key:string]:unknown};
  [key:string]:unknown;
}
export interface EditorialSession {schemaVersion:1;taskId:string;sceneId:string;messages:Message[]}
export interface AssembledContext {
  messages:Message[];
  task:EditorialTask;
  session:EditorialSession;
  manifest:{
    schemaVersion:1;id:string;taskId:string;sceneId:string;
    sources:{path:string;sha256:string;bytes:number;kind:string}[];
    selectedActorIds:string[];omittedActorIds:string[];
    budget:{maxInputChars:number;requiredChars:number;historyChars:number;totalChars:number;unit:string};
    history:{totalExchanges:number;retainedExchanges:number;prunedExchanges:number};
    requiresHumanReview:true;
  };
}
export function assembleContext(options?:{manifestPath?:string;taskPath?:string;sessionPath?:string;maxInputChars?:number}):Promise<AssembledContext>;
/** ok is structural only. draft is untrusted until ok and subsequent human review. */
export function validateEditorial(text:unknown,task:unknown):{ok:boolean;issues:string[];draft?:unknown;review?:string};
export function createLlmServer(options:{config:Config;secrets:Secrets;env?:Record<string,string|undefined>;generateImpl?:typeof generate}):Server;
export class LlmError extends Error {
  code:string;
  details:Record<string,unknown>;
  constructor(code:string,message:string,details?:Record<string,unknown>);
  toJSON():{code:string;message:string;[key:string]:unknown};
}
