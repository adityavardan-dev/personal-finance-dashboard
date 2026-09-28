import { expect, Page, test } from '@playwright/test';

const email = `a11y-${Date.now()}@example.com`;
const password = 'password123';
let detailPath = '';
let editPath = '';

async function registerAndLogin(page: Page) {
  await page.goto('/signup');
  await page.locator('#name').fill('Accessibility User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial('Milestone 8 accessibility and responsive hardening', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndLogin(page);
    await page.goto('/expenses/new');
    await page.locator('input[name="amount"]').fill('44');
    await page.locator('input[name="merchant"]').fill('Accessible expense');
    await page.getByRole('button', { name: 'Save expense' }).click();
    detailPath = await page.getByRole('link', { name: 'View Accessible expense' }).getAttribute('href') ?? '';
    editPath = await page.getByRole('link', { name: 'Edit Accessible expense' }).getAttribute('href') ?? '';
    await page.close();
  });

  for (const viewport of [
    { width: 320, height: 568, navigation: 'bottom' },
    { width: 375, height: 667, navigation: 'bottom' },
    { width: 425, height: 800, navigation: 'bottom' },
    { width: 768, height: 1024, navigation: 'collapsed' },
    { width: 1024, height: 768, navigation: 'expanded' },
    { width: 1440, height: 900, navigation: 'expanded' },
  ] as const) {
    test(`${viewport.width}px route matrix has no document overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);
      for (const path of ['/dashboard', '/insights', '/expenses/new', editPath, '/history', detailPath, '/profile']) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      }
      if (viewport.navigation === 'bottom') {
        await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden();
      } else {
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
        const dashboardLink = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: /Dashboard/ });
        await expect(dashboardLink).toHaveAttribute('title', 'Dashboard');
      }
      for (const path of ['/login', '/signup', '/forgot-password']) {
        await page.goto(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      }
    });
  }

  test('history controls meet minimum touch targets', async ({ page }) => {
    await login(page);
    await page.goto('/history');
    for (const control of [
      page.getByRole('button', { name: 'All' }),
      page.getByRole('button', { name: 'Expenses' }),
      page.getByRole('link', { name: 'Edit Accessible expense' }),
      page.getByRole('button', { name: 'Delete Accessible expense' }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('primary journey supports keyboard activation', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    const monthlyLimit = page.locator('#monthly-budget');
    await monthlyLimit.focus();
    await expect(monthlyLimit).toBeFocused();
    await page.keyboard.type('1200');
    await page.getByRole('button', { name: 'Save budget' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Budget saved.', { exact: true })).toBeVisible();

    const addExpense = page.getByRole('link', { name: 'Add Expense' }).first();
    await addExpense.focus();
    await page.keyboard.press('Enter');
    await page.locator('input[name="amount"]').focus();
    await page.keyboard.type('25');
    await page.locator('input[name="merchant"]').focus();
    await page.keyboard.type('Keyboard expense');
    await page.getByRole('button', { name: 'Save expense' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/history$/);

    const expenseFilter = page.getByRole('button', { name: 'Expenses' });
    await expenseFilter.focus();
    await page.keyboard.press('Space');
    await expect(expenseFilter).toHaveAttribute('aria-pressed', 'true');
    const viewLink = page.getByRole('link', { name: 'View Keyboard expense' });
    await viewLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/history\/.+/);
    await page.getByRole('link', { name: 'Back to history' }).focus();
    await page.keyboard.press('Enter');

    const profileLink = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Profile' });
    await profileLink.focus();
    await page.keyboard.press('Enter');
    const currency = page.locator('#profile-currency');
    await currency.focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Save preferences' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Preferences saved');
    await page.getByRole('button', { name: 'Log out' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('reduced motion and session expiry remain understandable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await login(page);
    await page.goto('/insights');
    const duration = await page.locator('button').first().evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
    await page.route('**/expenses', (route) => route.fulfill({ status: 401, body: '{}' }));
    await page.goto('/history');
    await expect(page).toHaveURL(/\/login\?reason=session-expired/);
    await expect(page.getByRole('status')).toContainText('Your session expired. Sign in again to continue.');
  });
});
