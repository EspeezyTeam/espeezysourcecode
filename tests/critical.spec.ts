import { test, expect } from '@playwright/test';

test.describe('Critical Path E2E', () => {
  test('Landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Espeezy/i);
  });

  test('User can sign up and sign in', async ({ page }) => {
    await page.goto('/login');
    // TODO: Fill in sign up form, submit, check dashboard
    // await page.fill('input[name="email"]', 'test@example.com');
    // ...
    expect(true).toBe(true); // Placeholder
  });

  test('Real-time sync works', async ({ page }) => {
    // TODO: Simulate two users, check real-time updates
    expect(true).toBe(true); // Placeholder
  });

  test('Offline game appears when offline', async ({ page }) => {
    // TODO: Simulate offline, check for OfflineGame
    expect(true).toBe(true); // Placeholder
  });
});
