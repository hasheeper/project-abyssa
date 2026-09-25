import { directorDocuments } from "./director-documents";
import { withSourceActivation } from "./source-activation";
import source0 from "../../../../st/setting/char/1-marietta.txt?raw";
import source1 from "../../../../st/setting/char/0-abyssa.txt?raw";
import source2 from "../../../../st/setting/airp_household_guidance.md?raw";

/** New resident material only. Legacy director/r8 source lists stay frozen. */
export const householdDirectorDocuments = withSourceActivation([
  ...directorDocuments,
  {id: "marietta", kind: "character" as const, path: "st/setting/char/1-marietta.txt", text: source0, sha256: "d31949143041079bb8ab553f3a765c91b007f49e4fffd9a566b8a6d31381eed7"},
  {id: "abyssa", kind: "character" as const, path: "st/setting/char/0-abyssa.txt", text: source1, sha256: "5ae62dadb1c3e711404d517ea38fb3cbafda6c4e9266658d203870844a298b91"},
  {id: "household-guidance", kind: "world" as const, path: "st/setting/airp_household_guidance.md", text: source2, sha256: "a399aac6def034ef0852f729ec4e1fd42a6756b9eb7ef96b6720dfa29c228abc"},
]);
