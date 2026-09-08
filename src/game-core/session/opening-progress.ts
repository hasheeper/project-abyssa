import * as v from "../contracts/validation";
import type { D5Catalog } from "../contracts/d5";

export type OpeningChoice = "A" | "B" | "C";
export type OpeningProgress = {step:number;status:"playing"|"viewed"|"skipped";choices:{step:number;choice:OpeningChoice}[]};
export type OpeningAdvance = {type:"opening-advanced";step:number;choice:"continue"|OpeningChoice};

/** Validate authored options in both live commands and independent evidence replay. */
export function validateOpeningChoice(spec:NonNullable<D5Catalog["opening"]>, event:OpeningAdvance) {
  v.number(event.step,"opening.step",0,spec.lastStep);
  const options=spec.choiceSteps.includes(event.step) ? spec.choiceOptions?.[event.step] ?? ["A","B","C"] : ["continue"];
  if(!options.includes(event.choice)) v.invalid("opening.choice","Select an authored option at a decision, otherwise continue");
}

/** This opening has fixed-length response branches, so cursors stay stable across all choices. */
export function advanceOpening(spec:D5Catalog["opening"], state:OpeningProgress|undefined, event:OpeningAdvance) {
  if(!spec || !state || state.status!=="playing" || state.step!==event.step) v.invalid("opening","Stale or completed opening cursor","command-not-available");
  validateOpeningChoice(spec,event);
  if(event.choice!=="continue") state.choices.push({step:event.step,choice:event.choice});
  if(state.step===spec.lastStep) state.status="viewed";
  else state.step++;
}
