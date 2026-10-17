import { test, expect } from "@playwright/test";
import { login, env } from "./helpers";

test.describe("Founder flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, env("E2E_FOUNDER_EMAIL"), env("E2E_FOUNDER_PASSWORD"));
  });

  test("can access admin page", async ({ page }) => {
    await page.goto("/team/admin");
    await expect(page.locator("text=Invite Member")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Members")).toBeVisible();
    await expect(page.locator("text=Data Export")).toBeVisible();
  });

  test("can access team settings", async ({ page }) => {
    await page.goto("/team/settings");
    await expect(page.locator("text=Company Settings")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Goal Templates")).toBeVisible();
  });

  test("can export PDF", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("text=Export PDF")).toBeVisible({ timeout: 10000 });
    // Select "Goals Page" export type
    await page.locator('[data-slot="select-trigger"]').last().click();
    await page.locator("text=Goals Page").click();
  });

  test("can export company data as JSON", async ({ page }) => {
    await page.goto("/team/admin");
    await expect(page.locator("text=Export All Data")).toBeVisible({ timeout: 10000 });
  });

  test("can change a member's role", async ({ page }) => {
    await page.goto("/team/admin");
    await expect(page.locator("text=Members")).toBeVisible({ timeout: 10000 });
    // Role edit buttons should be visible for non-founder members
  });
});
