export { IndexedDbGameStore } from "../../game-infrastructure/storage/indexeddb";
export { runStoreContract } from "../../game-application/testing/store-contract";
export {
  appFor,
  creation,
  opened,
  request,
  startCommand,
} from "../../game-application/testing/helpers";
export {
  runDemoStoreContract,
  versionedApp,
  demoCreation,
  demoOpened,
  demoRequest,
  demoStart,
} from "../../game-application/testing/demo-store-contract";
