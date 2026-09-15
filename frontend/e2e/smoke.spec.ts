import { expect, test } from '@playwright/test';

test('XPENSE smoke flow', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  await page.locator('#email').fill('admin@test.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good Afternoon, Aditya/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Recent transactions/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Profile/i }).nth(0)).toBeVisible();

  await page.getByRole('link', { name: /Profile/i }).nth(0).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
