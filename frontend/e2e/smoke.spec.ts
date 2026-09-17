import { expect, test } from '@playwright/test';

test('XPENSE smoke flow — login, dashboard, profile, logout', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  await page.locator('#email').fill('admin@test.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good (Morning|Afternoon|Evening)/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Recent transactions/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Profile/i }).nth(0)).toBeVisible();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('V1 expense journey — add expense persists to history and dashboard', async ({ page }) => {
  // Login via form (client-side navigation to /dashboard after success)
  await page.goto('/login');
  await page.locator('#email').fill('admin@test.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Navigate to Add Expense via sidebar (client-side routing — avoids SSR sessionStorage issue)
  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await expect(page.getByRole('heading', { name: 'Add an expense' })).toBeVisible();

  // Fill in a uniquely identifiable expense
  const merchant = `E2E-${Date.now()}`;
  await page.locator('input[name="amount"]').fill('999');
  await page.locator('input[name="merchant"]').fill(merchant);
  // category and date have sensible defaults

  // Submit — saveExpense calls POST /expenses then navigates client-side to /history
  await page.getByRole('button', { name: 'Save expense' }).click();

  // Verify navigation to /history, then wait for GET /expenses to settle
  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Verify the newly created expense appears in history
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 15000 });

  // Navigate to dashboard via sidebar and verify recent activity
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Recent transactions/i })).toBeVisible();

  // The newly added expense must appear in recent activity (last 5)
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 15000 });
});
