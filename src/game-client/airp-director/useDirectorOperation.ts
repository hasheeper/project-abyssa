import { useRef, useState } from "react";
import { directorStage } from "../../game-runtime/airp-director-view";

type DirectorJob = Parameters<typeof directorStage>[0];

/** Only progress belonging to this job can retire its local operation error. */
export function directorOperationRevision(job?: DirectorJob) {
  const attempt=job?.attempts.at(-1);
  return JSON.stringify([job && directorStage(job),attempt?.id,attempt?.status,
    job?.lowReadVersion,job?.lowFormatVersion,!!job?.text]);
}

export function useDirectorOperation(scope: string, revision: string) {
  const [working,setWorking]=useState(false);
  const [failure,setFailure]=useState<{scope:string;revision:string;message:string}|null>(null);
  const current=useRef({scope,revision}),flight=useRef(false);
  current.current={scope,revision};
  const work=async (operation:()=>Promise<unknown>)=>{
    if(flight.current)return;
    const owner=scope;
    flight.current=true;setWorking(true);setFailure(null);
    try {return await operation();}
    catch(error) {
      // A continuation can switch scenes before its request settles.
      if(current.current.scope===owner)setFailure({...current.current,message:error instanceof Error?error.message:"操作未完成，请重试。"});
      throw error;
    } finally {flight.current=false;setWorking(false);}
  };
  return {working,work,error:failure?.scope===scope&&failure.revision===revision?failure.message:""};
}
