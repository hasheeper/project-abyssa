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
afterEach(() => { cleanup(); fixture.session.dispose(); vi.restoreAllMocks(); });
it('shows campaign funds and keeps prototype transactions disabled', () => {
  render(<SceneTransitionProvider><ShopPage /></SceneTransitionProvider>);
  expect(screen.getByTestId('shop-funds')).toHaveTextContent('小队金币 123 · 远古晶石 2');
  for (const name of ['购买','出售','鉴定']) expect(screen.getByRole('button', { name })).toBeDisabled();
  expect(screen.getByRole('link', { name: '洋馆' })).toHaveAttribute('href', '#/mansion?save=save&epoch=epoch');
});
it('forwards both currency balances from the shop query to the player counter', () => {
  vi.spyOn(fixture.runtime.queries, 'shop').mockReturnValue({
    shopId: 'shop.mansion', quoteVersion: 1, funds: 123, crystals: 7,
    available: true, products: [],
  });
  render(<SceneTransitionProvider><ShopPage /></SceneTransitionProvider>);
  expect(screen.getByLabelText('小队金币余额 123')).toBeInTheDocument();
  expect(screen.getByLabelText('远古晶石余额 7')).toHaveAttribute('data-currency', 'crystal');
  expect(screen.getByRole('tab', { name: '购买' })).toHaveAttribute('aria-selected', 'true');
  for (const name of ['出售', '鉴定']) expect(screen.getByRole('tab', { name })).toBeDisabled();
});
