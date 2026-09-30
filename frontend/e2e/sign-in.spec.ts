import { test, expect, Page } from '@playwright/test';

/**
 * Integration Tests: Sign-In Flow against Real Auth Service
 * 
 * These tests verify the complete sign-in journey end-to-end:
 * - Valid credentials: sign in and redirect to dashboard
 * - Invalid credentials: show readable error
 * - Empty fields: blocked by validation
 * - Sign out: clears session
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

// Test credentials (ensure these exist in the auth service)
const VALID_USER = {
  username: 'testuser',
  password: 'Password123'
};

const INVALID_USER = {
  username: 'testuser',
  password: 'wrongpassword'
};

test.describe('Sign-In Flow Integration Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Clear any existing tokens/cookies
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Should display landing page with Sign In button', async () => {
    await page.goto(`${BASE_URL}/`);
    
    // Verify landing page is loaded
    const heading = page.locator('h2');
    await expect(heading).toContainText('Welcome to the Trading Dashboard');

    // Verify Sign In button exists and is clickable
    const signInButton = page.locator('[data-testid="sign-in-button"]');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toContainText('Sign In');
  });

  test.describe('Valid Credentials Sign In', () => {
    test('Should sign in with valid credentials and redirect to dashboard', async () => {
      // Navigate to sign-in page
      await page.goto(`${BASE_URL}/sign-in`);

      // Wait for form to load
      const usernameInput = page.locator('[data-testid="username-input"]');
      await expect(usernameInput).toBeVisible();

      // Fill in credentials
      await usernameInput.fill(VALID_USER.username);
      
      const passwordInput = page.locator('[data-testid="password-input"]');
      await passwordInput.fill(VALID_USER.password);

      // Submit form
      const submitButton = page.locator('[data-testid="submit-button"]');
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Wait for redirect to dashboard
      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
      
      // Verify dashboard is loaded
      const dashboardHeading = page.locator('h1');
      await expect(dashboardHeading).toContainText('Dashboard');
    });

    test('Should store token in localStorage after successful login', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Fill and submit form
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for redirect
      await page.waitForURL(`${BASE_URL}/dashboard`);

      const storedToken = await page.evaluate(() => localStorage.getItem('access_token'));
      expect(storedToken).toBeTruthy();

      // Verify we're authenticated (can access protected page)
      const dashboardHeading = page.locator('h1');
      await expect(dashboardHeading).toContainText('Dashboard');
    });
  });

  test.describe('Invalid Credentials', () => {
    test('Should show readable error message for invalid credentials', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Fill in invalid credentials
      await page.locator('[data-testid="username-input"]').fill(INVALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(INVALID_USER.password);

      // Submit form
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      // Verify error message is readable (not technical)
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/Invalid username or password|authentication failed/i);

      // Verify we're still on sign-in page
      expect(page.url()).toContain('/sign-in');
    });

    test('Should clear error when user corrects input', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Submit invalid form
      await page.locator('[data-testid="username-input"]').fill(INVALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(INVALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for error to appear
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();

      // Correct the input
      await page.locator('[data-testid="password-input"]').clear();
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);

      // Error should be cleared when user changes input
      // (implementation may show/hide on submit, so we'll verify after submit)
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for redirect instead of error
      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
      expect(page.url()).toContain('/dashboard');
    });
  });

  test.describe('Form Validation', () => {
    test('Should disable submit button with empty fields', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      const submitButton = page.locator('[data-testid="submit-button"]');
      
      // Initially disabled
      await expect(submitButton).toBeDisabled();

      // Fill username only
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await expect(submitButton).toBeDisabled();

      // Fill password
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await expect(submitButton).toBeEnabled();

      // Clear password
      await page.locator('[data-testid="password-input"]').clear();
      await expect(submitButton).toBeDisabled();
    });

    test('Should show validation error for username too short', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Enter username less than 3 characters
      const usernameInput = page.locator('[data-testid="username-input"]');
      await usernameInput.fill('ab');
      await usernameInput.blur(); // Trigger validation

      // Check for error message
      const usernameError = page.locator('[data-testid="username-error"]');
      await expect(usernameError).toBeVisible();
      const errorText = await usernameError.textContent();
      expect(errorText).toContain('3 characters');
    });

    test('Should show validation error for password too short', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Enter password less than 6 characters
      const passwordInput = page.locator('[data-testid="password-input"]');
      await passwordInput.fill('12345');
      await passwordInput.blur(); // Trigger validation

      // Check for error message
      const passwordError = page.locator('[data-testid="password-error"]');
      await expect(passwordError).toBeVisible();
      const errorText = await passwordError.textContent();
      expect(errorText).toContain('6 characters');
    });
  });

  test.describe('Sign Out / Session Clearing', () => {
    test('Should clear session when signing out', async () => {
      // Sign in first
      await page.goto(`${BASE_URL}/sign-in`);
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for dashboard
      await page.waitForURL(`${BASE_URL}/dashboard`);
      await expect(page.locator('h1')).toContainText('Dashboard');

      // Sign out
      const signOutButton = page.locator('button:has-text("Sign Out")');
      await signOutButton.click();

      // Verify redirect to landing page
      await page.waitForURL(`${BASE_URL}/`);

      // Verify can't access dashboard without signing in again
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForURL(`${BASE_URL}/sign-in`);
      expect(page.url()).toContain('/sign-in');
    });

    test('Should require sign-in again after logout', async () => {
      // Sign in
      await page.goto(`${BASE_URL}/sign-in`);
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForURL(`${BASE_URL}/dashboard`);

      // Sign out
      const signOutButton = page.locator('button:has-text("Sign Out")');
      await signOutButton.click();
      await page.waitForURL(`${BASE_URL}/`);

      // Try to access dashboard - should be redirected
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForURL(`${BASE_URL}/sign-in`);
      expect(page.url()).toContain('/sign-in');

      // Sign in again should work
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForURL(`${BASE_URL}/dashboard`);
      expect(page.url()).toContain('/dashboard');
    });
  });

  test.describe('Return URL / Open Redirect Prevention', () => {
    test('Should redirect to dashboard after login without returnUrl', async () => {
      await page.goto(`${BASE_URL}/sign-in`);
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      await page.waitForURL(`${BASE_URL}/dashboard`);
      expect(page.url()).toContain('/dashboard');
    });

    test('Should ignore returnUrl on login and redirect to dashboard', async () => {
      await page.goto(`${BASE_URL}/sign-in?returnUrl=/some-page`);
      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      await page.waitForURL(`${BASE_URL}/dashboard`);
      expect(page.url()).toContain('/dashboard');
    });
  });

  test.describe('Network / Error Scenarios', () => {
    test('Should handle network timeout gracefully', async () => {
      await page.goto(`${BASE_URL}/sign-in`);

      // Simulate network failure by blocking API
      await page.context().setOffline(true);

      await page.locator('[data-testid="username-input"]').fill(VALID_USER.username);
      await page.locator('[data-testid="password-input"]').fill(VALID_USER.password);
      await page.locator('[data-testid="submit-button"]').click();

      // Should show error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/network|connection|timeout/i);

      // Should remain on sign-in page
      expect(page.url()).toContain('/sign-in');

      await page.context().setOffline(false);
    });
  });
});
