import { type Page } from "@playwright/test";

/**
 * Log in via Supabase email/password.
 * Requires test users to exist in the database already.
 * Set E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD, etc. in .env.local.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait for redirect to dashboard
  await page.waitForURL("/", { timeout: 10000 });
}

export function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var ${key} — set it in .env.local for e2e tests`);
  return val;
}
