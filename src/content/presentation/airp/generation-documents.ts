// Full author-owned files: raw imports preserve every character. No summaries.
import source0 from "../../../../st/setting/world_setting_bible.txt?raw";
import source1 from "../../../../st/setting/world_history.txt?raw";
import source2 from "../../../../st/setting/prequel_chronicle.txt?raw";
import source3 from "../../../../st/setting/current_situation.txt?raw";
import source4 from "../../../../st/setting/human_realms_overview.txt?raw";
import source5 from "../../../../st/setting/abyssal_court_overview.txt?raw";
import source6 from "../../../../st/setting/institutional_lore.txt?raw";
import source7 from "../../../../st/setting/economic_lore.txt?raw";
import source8 from "../../../../st/setting/Light & Shadow Dice.txt?raw";
import source9 from "../../../../st/setting/char/2-elora.txt?raw";
import source10 from "../../../../st/setting/user/0-kael.txt?raw";
import source11 from "../../../../docs/design/DEMO_DIALOGUE_VOICE_GUIDE.md?raw";
import source12 from "../../../../docs/design/NON_LLM_PLAYER_AGENCY_CONTRACT.md?raw";

export const generationDocuments = [
  { id: "world", kind: "world" as const, path: "st/setting/world_setting_bible.txt", sha256: "c21bf8f171a1b3e3d597b7779b3cf6ae183295998b4d5368c000f1d4c15f4ce9", text: source0 },
  { id: "history", kind: "world" as const, path: "st/setting/world_history.txt", sha256: "a0fd3731b1e2fcedc9a60e911482c525057e49a63f9756fbb78d6e538442d75f", text: source1 },
  { id: "prequel", kind: "world" as const, path: "st/setting/prequel_chronicle.txt", sha256: "368bba8dfd2370981ef88b8e4edabf6386f72c84443637aa20d13c65ea084d88", text: source2 },
  { id: "current", kind: "world" as const, path: "st/setting/current_situation.txt", sha256: "fb560c9cc190a8ff0ca3d72c204326cd86a398c79b451ed37f0c0c2478c5efef", text: source3 },
  { id: "human-realms", kind: "world" as const, path: "st/setting/human_realms_overview.txt", sha256: "37b0dcfe54f9755cf2c010aa319dc1290f35e0b9c0a98b3d34637ea5d2189987", text: source4 },
  { id: "abyssal-court", kind: "world" as const, path: "st/setting/abyssal_court_overview.txt", sha256: "de01ca945266461a67d9fe58ad784642671becd999ac85324353c1e1a3028ec0", text: source5 },
  { id: "institutions", kind: "world" as const, path: "st/setting/institutional_lore.txt", sha256: "78af230280e60587acdae3e196d05d10a4882837174b52a72f13b37cb841cccb", text: source6 },
  { id: "economy", kind: "world" as const, path: "st/setting/economic_lore.txt", sha256: "b081cab2b694d47d20ac7559acc16885c5351af8db259edfa92c1db4cbb1a0ff", text: source7 },
  { id: "dice", kind: "world" as const, path: "st/setting/Light & Shadow Dice.txt", sha256: "374143599343487526cebbdb8d430f44d2f723bff5b1e87fb0bcddb1fc04e080", text: source8 },
  { id: "elora", kind: "character" as const, path: "st/setting/char/2-elora.txt", sha256: "adaa9dc0b49b9011ff2b433a60f4e5596efe0240e139ef3dad764c6b8ab8ed50", text: source9 },
  { id: "player", kind: "player" as const, path: "st/setting/user/0-kael.txt", sha256: "9e5d1a613c5e8900c6392ec3c4d9b46c59fad53df4d94b3349b8325d601f76cd", text: source10 },
  { id: "voice-guide", kind: "guideline" as const, path: "docs/design/DEMO_DIALOGUE_VOICE_GUIDE.md", sha256: "7bc46be40fbe9600d4b62b93ca24dc571a8b83123ccee8bc6b40bb29e5701035", text: source11 },
  { id: "player-agency", kind: "guideline" as const, path: "docs/design/NON_LLM_PLAYER_AGENCY_CONTRACT.md", sha256: "1a18d66215ac4ae761985cb4d52e42376df57bb26ca6da03c873fdef87f7aac6", text: source12 },
];
