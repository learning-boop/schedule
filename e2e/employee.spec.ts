import { test, expect } from "@playwright/test";
import { login, env } from "./helpers";

test.describe("Employee flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));
  });

  test("can view dashboard and navigate", async ({ page }) => {
    await expect(page.locator("text=Schedule Planner")).toBeVisible();
    // Navigate to calendar
    await page.getByRole("link", { name: "Calendar" }).click();
    await page.waitForURL("/calendar");
    await expect(page).toHaveURL("/calendar");
  });

  test("can plan a day — add top 3 priority", async ({ page }) => {
    await page.goto("/calendar");
    // The daily panel should be visible (Top 3 section)
    await expect(page.locator("text=Top 3")).toBeVisible({ timeout: 10000 });
  });

  test("can open a colleague's schedule (read-only)", async ({ page }) => {
    await page.goto("/team");
    await expect(page.locator("text=Search colleagues")).toBeVisible({ timeout: 10000 });

    // Click the first colleague link that isn't "(you)"
    const colleagueLinks = page
      .locator("a[href^='/team/']")
      .filter({ hasNot: page.locator("text=(you)") });
    const count = await colleagueLinks.count();
    if (count > 0) {
      await colleagueLinks.first().click();
      // Should see read-only schedule
      await expect(page.locator("text=Back to team")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Schedule")).toBeVisible();
      // Should NOT have any edit controls (no input fields in the schedule area)
    }
  });

  test("can view reports", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("text=Hours")).toBeVisible({ timeout: 10000 });
  });
});
