import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const SCREENSHOT_DIR = join(process.cwd(), 'qa/artifacts/screenshots/latest');

function ensureScreenshotDir(): void {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function saveScreenshot(page: Page, filename: string): Promise<void> {
  ensureScreenshotDir();
  await page.screenshot({
    path: join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
}

async function clearAuthStorage(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

async function waitForAuthDefault(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.getByTestId('auth-forgot-password')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Organizer access')).toBeVisible();
  await expect(page.getByTestId('auth-mode-sign-in')).toBeVisible();
  await expect(page.getByTestId('auth-mode-create-account')).toBeVisible();
}

test.describe('auth web QA', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('auth default page shows Forgot password', async ({ page }) => {
    await waitForAuthDefault(page);

    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByTestId('auth-submit-sign-in')).toBeVisible();
    await expect(page.getByText('Create Account')).toBeVisible();

    await saveScreenshot(page, '06-auth-default.png');
  });

  test('forgot password shows reset request UI', async ({ page }) => {
    await waitForAuthDefault(page);

    await page.getByTestId('auth-forgot-password').click();

    await expect(page.getByTestId('auth-forgot-password-hint')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Enter your organizer email and we will send a reset link.')).toBeVisible();
    await expect(page.getByTestId('auth-send-reset-link')).toBeVisible();
    await expect(page.getByTestId('auth-back-to-sign-in')).toBeVisible();
    await expect(page.getByTestId('auth-password-input')).toHaveCount(0);

    await saveScreenshot(page, '07-auth-forgot-password.png');
  });

  test('submitting reset request shows reset-sent message', async ({ page }) => {
    await waitForAuthDefault(page);

    await page.getByTestId('auth-forgot-password').click();
    await expect(page.getByTestId('auth-send-reset-link')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('auth-email-input').fill('qa-reset@example.com');
    await page.getByTestId('auth-send-reset-link').click();

    await expect(page.getByTestId('auth-reset-sent')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('auth-reset-sent-title')).toHaveText('Reset link sent');
    await expect(page.getByText(/If an account exists for qa-reset@example.com/i)).toBeVisible();

    await saveScreenshot(page, '08-auth-reset-sent.png');
  });

  test('signup confirmation shows check-email UI', async ({ page }) => {
    const signupEmail = `qa-confirm-${Date.now()}@example.com`;

    // Prove confirmation UX independently of dashboard Confirm Email / SMTP.
    // When confirmation is required, GoTrue returns a user object without session tokens.
    await page.route('**/auth/v1/signup**', async (route) => {
      const raw = route.request().postData() ?? '{}';
      let email = signupEmail;

      try {
        const body = JSON.parse(raw) as { email?: string };
        if (body.email) {
          email = body.email;
        }
      } catch {
        // keep default
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000099',
          aud: 'authenticated',
          role: 'authenticated',
          email,
          phone: '',
          confirmation_sent_at: new Date().toISOString(),
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [
            {
              identity_id: '00000000-0000-4000-8000-000000000098',
              id: '00000000-0000-4000-8000-000000000099',
              user_id: '00000000-0000-4000-8000-000000000099',
              identity_data: { email, sub: '00000000-0000-4000-8000-000000000099' },
              provider: 'email',
              last_sign_in_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await waitForAuthDefault(page);
    await page.getByTestId('auth-mode-create-account').click();

    await expect(page.getByTestId('auth-confirm-password-input')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('auth-email-input').fill(signupEmail);
    await page.getByTestId('auth-password-input').fill('password123');
    await page.getByTestId('auth-confirm-password-input').fill('password123');
    await page.getByTestId('auth-submit-create-account').click();

    await expect(page.getByTestId('auth-check-email')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('auth-check-email-title')).toHaveText('Check your email');
    await expect(page.getByText(signupEmail)).toBeVisible();
    await expect(page.getByText(/We sent a confirmation link/i)).toBeVisible();

    await saveScreenshot(page, '09-auth-check-email.png');
  });
});
