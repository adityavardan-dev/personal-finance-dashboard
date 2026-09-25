import { expect, Page, test } from '@playwright/test';

async function register(page: Page, username = `E2E User ${Date.now()}`) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'password123';

  await page.goto('/signup');
  await page.locator('#name').fill(username);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('status')).toContainText('Your account is ready');
  await expect(page).toHaveURL(/\/login$/, { timeout: 5000 });

  return { email, password, username };
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signupAndLogin(page: Page) {
  const credentials = await register(page);
  await login(page, credentials.email, credentials.password);
  return credentials;
}

test('XPENSE smoke flow — login, dashboard, profile, logout', async ({ page }) => {
  const credentials = await signupAndLogin(page);

  await expect(page.getByRole('heading', { name: /Good (Morning|Afternoon|Evening)/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Recent transactions/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Profile/i }).nth(0)).toBeVisible();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(credentials.email, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('V1 expense journey — add expense persists to history and dashboard', async ({ page }) => {
  await signupAndLogin(page);

  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await expect(page.getByRole('heading', { name: 'Add an expense' })).toBeVisible();

  const merchant = `E2E-${Date.now()}`;
  await page.locator('input[name="amount"]').fill('999');
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 15000 });

  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Recent transactions/i })).toBeVisible();
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 15000 });
});

test('V1 expense CRUD — create, edit, delete full lifecycle', async ({ page }) => {
  await signupAndLogin(page);

  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await expect(page.getByRole('heading', { name: 'Add an expense' })).toBeVisible();

  const merchant = `E2E-CRUD-${Date.now()}`;
  await page.locator('input[name="amount"]').fill('750');
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(merchant, { exact: true })).toBeVisible({ timeout: 15000 });

  const row = page.locator('article').filter({ hasText: merchant });
  await row.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/expenses\/.+\/edit$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Edit expense' })).toBeVisible();

  const updatedMerchant = `${merchant}-EDITED`;
  await page.locator('input[name="merchant"]').clear();
  await page.locator('input[name="merchant"]').fill(updatedMerchant);
  await page.getByRole('button', { name: 'Update expense' }).click();

  await expect(page).toHaveURL(/\/history$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(updatedMerchant, { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(merchant, { exact: true })).not.toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());

  const updatedRow = page.locator('article').filter({ hasText: updatedMerchant });
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(updatedMerchant, { exact: true })).not.toBeVisible({ timeout: 10000 });
});

test('V1 signup persistence — signup, login, profile, logout and protected route', async ({ page }) => {
  const credentials = await register(page, `Signup E2E ${Date.now()}`);

  await expect(page).toHaveURL(/\/login$/);
  await login(page, credentials.email, credentials.password);

  await expect(page.getByRole('heading', { name: /Good (Morning|Afternoon|Evening)/i })).toBeVisible();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(credentials.email, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('V1 signup persistence — duplicate email is rejected', async ({ page }) => {
  const credentials = await register(page, `Duplicate E2E ${Date.now()}`);

  await page.goto('/signup');
  await page.locator('#name').fill(`Duplicate Again ${Date.now()}`);
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#confirm-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('alert')).toContainText('An account with this email already exists');
  await expect(page).toHaveURL(/\/signup$/);
});
