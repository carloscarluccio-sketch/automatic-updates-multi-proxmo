/**
 * End-to-End tests for Authentication flows
 * Tests login, logout, password reset, 2FA using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const baseURL = process.env.BASE_URL || 'http://192.168.142.237';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/ProxPanel|Login/);
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Verify user info is displayed
    await expect(page.locator('text=testuser')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');

    // Should stay on login page
    await expect(page.locator('text=Invalid')).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test('should show error with empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');

    await expect(page.locator('text=required')).toBeVisible();
  });

  test('should navigate to forgot password', async ({ page }) => {
    await page.click('text=Forgot Password');

    await page.waitForURL('**/forgot-password');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page, context }) => {
    // Login first
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Click logout
    await page.click('button:has-text("Logout")');

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page.locator('input[name="username"]')).toBeVisible();

    // Verify token is cleared
    const cookies = await context.cookies();
    const token = cookies.find(c => c.name === 'token');
    expect(token).toBeUndefined();
  });

  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=testuser')).toBeVisible();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    await page.goto(`${baseURL}/vms`);

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test('should handle password reset flow', async ({ page }) => {
    await page.click('text=Forgot Password');
    await page.waitForURL('**/forgot-password');

    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=reset link')).toBeVisible();
  });

  test('should enforce password requirements', async ({ page }) => {
    // Assume there's a change password page
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to change password
    await page.goto(`${baseURL}/profile`);
    await page.click('text=Change Password');

    await page.fill('input[name="currentPassword"]', 'Test123!');
    await page.fill('input[name="newPassword"]', '123'); // Weak password
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=password must')).toBeVisible();
  });
});

test.describe('2FA Authentication', () => {
  const baseURL = process.env.BASE_URL || 'http://192.168.142.237';

  test('should redirect to 2FA setup after first login', async ({ page }) => {
    // Create new user without 2FA
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="username"]', 'new2fauser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');

    // Should redirect to 2FA setup
    await page.waitForURL('**/2fa');
    await expect(page.locator('text=Set up Two-Factor')).toBeVisible();
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();
  });

  test('should setup 2FA with QR code', async ({ page }) => {
    await page.goto(`${baseURL}/2fa`);

    // QR code should be visible
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();

    // Manual code should be visible as fallback
    await expect(page.locator('text=Manual Entry')).toBeVisible();

    // Enter verification code
    await page.fill('input[name="verificationCode"]', '123456');
    await page.click('button:has-text("Verify")');

    // Should show error for invalid code
    await expect(page.locator('text=Invalid code')).toBeVisible();
  });

  test('should prompt for 2FA code on login', async ({ page }) => {
    // Login with user who has 2FA enabled
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="username"]', '2fauser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');

    // Should see 2FA verification page
    await expect(page.locator('text=Enter verification code')).toBeVisible();
    await expect(page.locator('input[name="code"]')).toBeVisible();
  });

  test('should reject invalid 2FA codes', async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="username"]', '2fauser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');

    // Enter invalid code
    await page.fill('input[name="code"]', '000000');
    await page.click('button:has-text("Verify")');

    await expect(page.locator('text=Invalid')).toBeVisible();
  });
});
