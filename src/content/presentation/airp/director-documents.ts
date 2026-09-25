import { generationDocuments } from "./generation-documents";
import { withSourceActivation } from "./source-activation";
import eustice from "../../../../st/setting/char/2-eustice.txt?raw";
import norma from "../../../../st/setting/char/2-norma.txt?raw";
import kororo from "../../../../st/setting/char/2-kororo.txt?raw";

/** New material snapshot only; original documents and the old release manifest are untouched. */
export const directorDocuments = [
  ...generationDocuments,
  {id: "eustice", kind: "character" as const, path: "st/setting/char/2-eustice.txt", text: eustice, sha256: "f3564aba7db802c8bd55dc82cab25028f4ea557112f6287cddb2476935d827d1"},
  {id: "norma", kind: "character" as const, path: "st/setting/char/2-norma.txt", text: norma, sha256: "34eb1e267d8f7e5585b3dd301f12fabadcc0a74a532a882245dc86bfa010c677"},
  {id: "kororo", kind: "character" as const, path: "st/setting/char/2-kororo.txt", text: kororo, sha256: "8a377bb2fec1ff5b3978ed57fc35015d61bc3e4298886e07a65cc06cacb85f06"},
];

export const activatedDirectorDocuments = withSourceActivation(directorDocuments);
