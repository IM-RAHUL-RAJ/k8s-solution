import { expect, test } from '@playwright/test';
import { env } from './env';
import { assertStackIsUp, signIn } from './support';

// Journey 2: place an order. Each test signs in for itself and seeds nothing another test reads.
test.describe('place an order', () => {
  test.beforeAll(async ({ request }) => {
    await assertStackIsUp(request);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/order-ticket');
    await signIn(page);
    await expect(page).toHaveURL(/\/order-ticket$/);
  });

  test('the account is the one this sign-in may trade, and it is read only', async ({ page }) => {
    const account = page.getByTestId('order-account');

    await expect(account).toHaveValue(env.accountId);
    await expect(account).toHaveAttribute('readonly', '');
  });

  test('an invalid order is stopped before it is submitted', async ({ page }) => {
    let posted = false;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/v1/orders')) {
        posted = true;
      }
    });

    await page.getByTestId('order-symbol').fill(env.symbol);
    await page.getByTestId('order-quantity').fill('12.5');
    await page.getByTestId('order-price').fill('10.123');

    await expect(page.getByText('Enter a whole number above zero.')).toBeVisible();
    await expect(page.getByText('Use at most two decimal places.')).toBeVisible();
    await expect(page.getByTestId('place-order')).toBeDisabled();
    expect(posted).toBe(false);
  });

  test('a placed order shows whatever status came back', async ({ page }) => {
    await page.getByTestId('order-symbol').fill(env.symbol);
    await page.getByTestId('side-buy').click();
    await page.getByTestId('order-quantity').fill('1');
    await page.getByTestId('order-price').fill('10.00');

    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/v1/orders')
    );
    await page.getByTestId('place-order').click();
    await response;

    // The API answers before the fill exists. NEW, FILLED and REJECTED are all valid; asserting
    // one of them would fail the week the executor is switched on.
    await expect(page.getByTestId('order-status')).toHaveText(/NEW|FILLED|REJECTED/);
  });
});
