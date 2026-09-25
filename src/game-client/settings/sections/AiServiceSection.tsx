import { DirectAiSettings } from "../../airp-generation/DirectAiSettings";

export function AiServiceSection(_props: {embedded?: boolean}) {
  return <DirectAiSettings layout="panel" fixedR8 saveInFooter/>;
}
