import { render, screen, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { clientFixture } from '../../game-client/testing/helpers';
import { SceneTransitionProvider } from '../../shared/transition';
import { ShopPage } from './ShopPage';
let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock('../../game-client/react', async importOriginal => {
  const original = await importOriginal<typeof import('../../game-client/react')>();
  return { ...original, GameProvider: ({ children }: { children: React.ReactNode }) => <original.GameSessionScope session={fixture.session}>{children}</original.GameSessionScope> };
});
beforeEach(async () => { fixture = await clientFixture({ start: false, initial: { funds: { public: 40, party: 123, crystals: 2 } } }); });
afterEach(() => { cleanup(); fixture.session.dispose(); });
it('shows campaign funds and keeps prototype transactions disabled', () => {
  render(<SceneTransitionProvider><ShopPage /></SceneTransitionProvider>);
  expect(screen.getByTestId('shop-funds')).toHaveTextContent('小队金币 123 · 远古晶石 2');
  for (const name of ['购买','出售','鉴定']) expect(screen.getByRole('button', { name })).toBeDisabled();
  expect(screen.getByRole('link', { name: '洋馆' })).toHaveAttribute('href', '#/mansion?save=save&epoch=epoch');
});
