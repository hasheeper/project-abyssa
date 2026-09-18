import {generate,assembleContext,loadConfig,loadSecrets,selectProfile,resolveKey,validateEditorial,createLlmServer,type ApiFormat} from '../src/index.mjs';
async function consumer() {
  const c=await loadConfig(),s=await loadSecrets(),p=selectProfile(c);
  const context=await assembleContext({maxInputChars:120000});
  const result=await generate({profile:p,apiKey:resolveKey(p,s),request:{messages:context.messages},signal:new AbortController().signal});
  const format:ApiFormat=result.format;
  const valid:boolean=validateEditorial(result.text,context.task).ok;
  createLlmServer({config:c,secrets:s}).close();
  // @ts-expect-error Browser/vendor payloads aren't the normalized text contract.
  await generate({profile:p,apiKey:'',request:{contents:[]}});
  // @ts-expect-error Unknown native protocol must not silently fall back.
  const wrong:ApiFormat='auto';
  return{format,valid,wrong};
}
void consumer; // Compile-only API example, never invoked or sent to a provider.
