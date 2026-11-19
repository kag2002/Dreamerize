import { Page, APIRequestContext } from '@playwright/test';

export interface TestUser {
  username: string;
  email: string;
  password: string;
  role: 'creator' | 'visitor';
}

export const TEST_USERS = {
  creator: {
    username: 'admin',
    email: 'admin@dreamerize.local',
    password: 'AdminPass123!',
    role: 'creator' as const,
  },
  visitor: {
    username: 'visitor',
    email: 'visitor@dreamerize.local',
    password: 'VisitorPass123!',
    role: 'visitor' as const,
  },
};

/**
 * Generates a unique test user with random suffix to avoid DB collision during repeated runs
 */
export function generateUniqueUser(role: 'creator' | 'visitor' = 'visitor'): TestUser {
  const timestamp = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return {
    username: `${role}_${timestamp}_${rand}`,
    email: `${role}_${timestamp}_${rand}@dreamerize.local`,
    password: `Password_${timestamp}!`,
    role,
  };
}

/**
 * Logs in a user via the REST API and returns token & user payload
 */
export async function loginViaApi(
  request: APIRequestContext,
  credentials: { username: string; password: string }
) {
  const response = await request.post('/api/auth/login', {
    data: {
      username: credentials.username,
      password: credentials.password,
    },
  });

  const status = response.status();
  const body = await response.json().catch(() => null);

  return {
    status,
    response,
    body,
    token: body?.token as string | undefined,
    user: body?.user as { id: string; username: string; email: string; role: string } | undefined,
  };
}

/**
 * Registers a new user via the REST API
 */
export async function registerViaApi(
  request: APIRequestContext,
  userData: { username: string; email: string; password: string; role?: 'creator' | 'visitor' }
) {
  const response = await request.post('/api/auth/register', {
    data: userData,
  });

  const status = response.status();
  const body = await response.json().catch(() => null);

  return {
    status,
    response,
    body,
    user: body?.user,
  };
}

/**
 * Sets the authentication cookie directly on the browser context for authenticated page navigation
 */
export async function setAuthCookie(page: Page, token: string) {
  const currentUrl = page.url();
  const url = new URL(currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://localhost:5173');
  await page.context().addCookies([
    {
      name: 'token',
      value: token,
      domain: url.hostname || 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Logs in via UI form if present on the page
 */
export async function loginViaUI(
  page: Page,
  credentials: { username: string; password: string }
) {
  // If login modal trigger exists, click it
  const loginTrigger = page.locator('button:has-text("Log in"), button:has-text("Login"), [data-testid="login-btn"]');
  if (await loginTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
    await loginTrigger.click();
  }

  const usernameInput = page.locator('input[name="username"], input#username, [data-testid="username-input"]');
  const passwordInput = page.locator('input[name="password"], input#password, [data-testid="password-input"]');
  const submitButton = page.locator('button[type="submit"]:has-text("Log in"), button[type="submit"]:has-text("Login"), [data-testid="auth-submit"]');

  await usernameInput.fill(credentials.username);
  await passwordInput.fill(credentials.password);
  await submitButton.click();
}

/**
 * Logs out via UI if logout button is present
 */
export async function logoutViaUI(page: Page) {
  const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), [data-testid="logout-btn"]');
  await logoutBtn.click();
}
