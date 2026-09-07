import { defineProject } from "vitest/config";
export default defineProject({test:{name:"application",include:["src/game-application/**/*.test.ts","src/game-infrastructure/**/*.test.ts"],environment:"node",setupFiles:[]}});
