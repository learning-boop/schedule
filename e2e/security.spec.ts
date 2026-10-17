import { test, expect } from "@playwright/test";
import { login, env } from "./helpers";

test.describe("Security: cross-user access controls", () => {
  test("employee can read a colleague's schedule (same org)", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    const res = await page.request.get(
      `/api/team/${env("E2E_COLLEAGUE_ID")}/schedule?date=2026-10-17`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.blocks).toBeDefined();
  });

  test("employee cannot edit a colleague's time block via API", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    // Attempt to create a block on colleague's behalf — the API uses auth user_id,
    // so even if we call the blocks API it'll only affect our own data
    const res = await page.request.put(`/api/time-blocks/${env("E2E_COLLEAGUE_BLOCK_ID")}`, {
      data: { title: "HACKED" },
    });
    // Should fail because the block belongs to another user
    expect(res.status()).not.toBe(200);
  });

  test("employee cannot read colleague's goals when visibility is 'schedule'", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    const res = await page.request.get(
      `/api/team/${env("E2E_COLLEAGUE_ID")}/schedule?date=2026-10-17`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    // With schedule-only visibility, goals and notes should NOT be present
    expect(data.goals).toBeUndefined();
    expect(data.notes).toBeUndefined();
  });

  test("employee cannot read data from another company", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    // Try to read a user from a different org
    const res = await page.request.get(
      `/api/team/${env("E2E_OTHER_ORG_USER_ID")}/schedule?date=2026-10-17`,
    );
    // Should return 403 "Not a colleague"
    expect(res.status()).toBe(403);
  });

  test("employee cannot access admin endpoints", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    const res = await page.request.put("/api/admin/members", {
      data: { userId: env("E2E_COLLEAGUE_ID"), role: "founder" },
    });
    expect(res.status()).toBe(403);
  });

  test("employee cannot change team settings", async ({ page }) => {
    await login(page, env("E2E_EMPLOYEE_EMAIL"), env("E2E_EMPLOYEE_PASSWORD"));

    const res = await page.request.put("/api/team/settings", {
      data: { planner_visibility: "full" },
    });
    expect(res.status()).toBe(403);
  });

  test("manager cannot promote to founder", async ({ page }) => {
    await login(page, env("E2E_MANAGER_EMAIL"), env("E2E_MANAGER_PASSWORD"));

    const res = await page.request.put("/api/admin/members", {
      data: { userId: env("E2E_EMPLOYEE_ID"), role: "founder" },
    });
    expect(res.status()).toBe(403);
  });

  test("unauthenticated requests are rejected", async ({ page }) => {
    // Don't log in — make direct API calls
    const endpoints = [
      "/api/goals",
      "/api/time-blocks?start=2026-10-01&end=2026-10-31",
      "/api/team/members",
      "/api/team/now",
      "/api/admin/export",
    ];

    for (const url of endpoints) {
      const res = await page.request.get(url);
      expect(res.status()).toBe(401);
    }
  });
});
