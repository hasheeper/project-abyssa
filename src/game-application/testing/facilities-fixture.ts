import { shopFixture } from "./shop-foundation-fixture";
export async function facilitiesFixture(version = 25) {
  const f = shopFixture();
  const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: version, profileId: "profile.demo.first-run", saveId: f.saveId, epoch: "facility", clientRequestId: "create"});
  if (!created.ok) throw Error(JSON.stringify(created));
  await f.commit({type: "select-game-start", startAt: "hub"});
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) await f.commit({type: "advance-phase"}); };
  const state = () => f.read().snapshot.campaign;
  return {...f, tick, state};
}
