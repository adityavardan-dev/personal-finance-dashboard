import { expect, Page, test } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('admin@test.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('Expense CRUD — create, edit, delete full lifecycle', async ({ page }) => {
  await login(page);

  // --- CREATE ---
  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);

  const merchant = `CRUD-${Date.now()}`;
  await page.locator('input[name="amount"]').fill('500');
  await page.locator('input[name="merchant"]').fill(merchant);

  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 15000 });

  // --- EDIT ---
  const row = page.locator('article').filter({ hasText: merchant });
  await row.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/expenses\/.+\/edit$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Edit expense' })).toBeVisible();

  const updatedMerchant = `${merchant}-EDITED`;
  await page.locator('input[name="merchant"]').fill(updatedMerchant);
  await page.getByRole('button', { name: 'Update expense' }).click();

  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(updatedMerchant, { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(merchant, { exact: true })).not.toBeVisible();

  // --- DELETE ---
  page.on('dialog', (dialog) => dialog.accept());

  const updatedRow = page.locator('article').filter({ hasText: updatedMerchant });
  await updatedRow.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText(updatedMerchant)).not.toBeVisible({ timeout: 10000 });
});
