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

test('V1 budget persistence — setup, edit, thresholds, relogin and isolation', async ({ page }) => {
  const credentials = await signupAndLogin(page);

  await expect(page.getByText('Set your monthly budget to begin.').first()).toBeVisible();
  await page.locator('#monthly-budget').fill('30000');
  await page.locator('#budget-currency').selectOption('USD');
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByPlaceholder('Limit').fill('8000');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.getByText('Budget saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('$30,000', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: /Insights/i }).nth(0).click();
  await expect(page).toHaveURL(/\/insights$/);
  await expect(page.locator('section[aria-label="Spending summary"]').getByText('$30,000', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Dashboard/i }).nth(0).click();

  await page.getByRole('button', { name: 'Edit budget' }).click();
  await expect(page.getByPlaceholder('Limit')).toHaveValue('8000');
  await page.locator('#monthly-budget').fill('1000');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.getByText('$1,000', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await page.locator('input[name="amount"]').fill('850');
  await page.locator('input[name="merchant"]').fill(`Budget-${Date.now()}`);
  await page.getByRole('button', { name: 'Save expense' }).click();
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  const progress = page.getByRole('progressbar', { name: /Monthly budget/ });
  await expect(progress).toHaveAttribute('aria-valuenow', '85');
  await expect(progress.locator('div')).toHaveClass(/bg-amber-300/);
  await expect(page.locator('section[aria-label="Monthly spending overview"]').getByRole('alert')).toContainText('used 85%');

  await page.getByRole('button', { name: 'Edit budget' }).click();
  await page.locator('#monthly-budget').fill('800');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.getByText('Over budget', { exact: true })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '106.25');
  await expect(page.locator('section[aria-label="Monthly spending overview"]').getByRole('alert')).toContainText('over budget by $50');

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, credentials.email, credentials.password);
  await expect(page.getByText('$800', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit budget' }).click();
  await expect(page.getByPlaceholder('Limit')).toHaveValue('8000');

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await signupAndLogin(page);
  await expect(page.getByText('Set your monthly budget to begin.').first()).toBeVisible();
});

test('V1 dynamic insights — dashboard and insights derive metrics from user data', async ({ page }) => {
  await signupAndLogin(page);
  const now = new Date();
  const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const currentDate = toDateKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayDate = toDateKey(yesterday);
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const previousDate = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-15`;
  const currentLabel = now.toLocaleDateString('en-IN', { month: 'short' });
  const previousLabel = previous.toLocaleDateString('en-IN', { month: 'short' });
  const todayLabel = now.toLocaleDateString('en-IN', { weekday: 'short' });
  const yesterdayLabel = yesterday.toLocaleDateString('en-IN', { weekday: 'short' });

  await page.locator('#monthly-budget').fill('1000');
  await page.getByRole('button', { name: 'Save budget' }).click();

  async function addTransaction(amount: string, merchant: string, date: string, type: 'expense' | 'income' = 'expense') {
    await page.getByRole('link', { name: 'Add Expense' }).first().click();
    if (type === 'income') await page.locator('#transaction-type').selectOption('income');
    await page.locator('input[name="amount"]').fill(amount);
    await page.locator('input[name="merchant"]').fill(merchant);
    await page.locator('#date').fill(date);
    if (type === 'income') await page.locator('#category').selectOption('Salary');
    await page.getByRole('button', { name: type === 'income' ? 'Save income' : 'Save expense' }).click();
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await page.waitForLoadState('networkidle');
  }

  await addTransaction('100', `Previous-${Date.now()}`, previousDate);
  await addTransaction('80', `Yesterday-${Date.now()}`, yesterdayDate);
  await addTransaction('120', `Today-${Date.now()}`, currentDate);
  await addTransaction('500', `Income-${Date.now()}`, currentDate, 'income');

  await expect(page.getByRole('heading', { name: '₹200' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel(`${previousLabel}: ₹100`)).toBeVisible();
  await expect(page.getByLabel(`${currentLabel}: ₹200`)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Budget is on track' })).toBeVisible();

  await page.getByRole('link', { name: /Insights/i }).nth(0).click();
  const summary = page.locator('section[aria-label="Spending summary"]');
  await expect(summary.getByText('₹200', { exact: true })).toBeVisible();
  await expect(summary).toContainText('100% up from last month');
  await expect(page.getByText('Food & Dining', { exact: true })).toBeVisible();
  await expect(page.getByLabel(new RegExp(`${yesterdayLabel}, .*: spent ₹80`))).toBeVisible();
  await expect(page.getByLabel(new RegExp(`${todayLabel}, .*: spent ₹120`))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous week' })).toBeEnabled();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByRole('button', { name: 'Next week' })).toBeEnabled();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await signupAndLogin(page);
  await page.getByRole('link', { name: /Insights/i }).nth(0).click();
  await expect(page.getByText('Start tracking your spending')).toBeVisible();
});

test('V1 transaction history — expense and income remain truthful and isolated', async ({ page }) => {
  await signupAndLogin(page);

  const expenseMerchant = `Expense-${Date.now()}`;
  await page.getByRole('link', { name: 'Add Expense' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await page.locator('input[name="amount"]').fill('750');
  await page.locator('input[name="merchant"]').fill(expenseMerchant);
  await page.locator('#date').fill('2026-09-20');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL(/\/history$/);

  const incomeSource = `Employer-${Date.now()}`;
  await page.getByRole('link', { name: 'Add transaction' }).first().click();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await page.locator('#transaction-type').selectOption('income');
  await page.locator('input[name="amount"]').fill('50000');
  await page.locator('input[name="merchant"]').fill(incomeSource);
  await page.locator('#date').fill('2026-09-21');
  await page.locator('#category').selectOption('Salary');
  await page.getByRole('button', { name: 'Save income' }).click();
  await expect(page).toHaveURL(/\/history$/);

  const summary = page.locator('section[aria-label="Transaction summary"]');
  await expect(summary.locator('article').filter({ has: page.getByText('Expenses', { exact: true }) })).toContainText('750');
  await expect(summary.locator('article').filter({ has: page.getByText('Income', { exact: true }) })).toContainText('50,000');

  await page.getByRole('button', { name: 'Income', exact: true }).click();
  await expect(page.getByText(incomeSource, { exact: true })).toBeVisible();
  await expect(page.getByText(expenseMerchant, { exact: true })).not.toBeVisible();

  await page.locator('#history-category').selectOption('Salary');
  await page.locator('#history-from').fill('2026-09-21');
  await page.locator('#history-to').fill('2026-09-21');
  await expect(page.getByText(incomeSource, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  const expenseRow = page.locator('article').filter({ hasText: expenseMerchant });
  await expenseRow.getByRole('link', { name: `View ${expenseMerchant}` }).click();
  await expect(page).toHaveURL(/\/history\/.+$/);
  await expect(page.getByRole('heading', { name: 'Review transaction' })).toBeVisible();
  await expect(page.getByText(expenseMerchant, { exact: true })).toBeVisible();
  await expect(page.getByText('Food & Dining', { exact: true })).toBeVisible();
  const firstUserDetailUrl = page.url();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await signupAndLogin(page);

  const firstUserDetailPath = new URL(firstUserDetailUrl).pathname;
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, firstUserDetailPath);
  await expect(page).toHaveURL(firstUserDetailUrl);
  await expect(page.getByRole('heading', { name: 'Transaction not found' })).toBeVisible();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto(firstUserDetailUrl);
  await expect(page).toHaveURL(/\/login$/);
});
