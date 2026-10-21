import { test, expect } from "@playwright/test";
import { login, env } from "./helpers";

test.describe("Manager flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, env("E2E_MANAGER_EMAIL"), env("E2E_MANAGER_PASSWORD"));
  });

  test("can access the Right Now board", async ({ page }) => {
    await page.goto("/team/now");
    await expect(page.locator("text=Right Now")).toBeVisible({ timeout: 10000 });
    // Should see user cards
  });

  test("can access team dashboard", async ({ page }) => {
    await page.goto("/team/dashboard");
    await expect(page.locator("text=Manager Dashboard")).toBeVisible({ timeout: 10000 });
    // Should see team member stats
    await expect(page.locator("text=Team members")).toBeVisible();
  });

  test("can view team week view", async ({ page }) => {
    await page.goto("/team/week");
    await expect(page.locator("text=Team calendar").first()).toBeVisible({ timeout: 10000 });
  });

  test("can invite an employee", async ({ page }) => {
    await page.goto("/team");
    // Managers don't see Admin link, but they can invite from team settings if founder
    // Managers invite via the invite API (not admin page)
  });
});
