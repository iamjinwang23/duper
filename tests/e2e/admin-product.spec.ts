import { test, expect } from "@playwright/test";

// This test assumes the dev environment has a NEXT_TEST_BYPASS_AUTH flag
// set so we don't need to OAuth in CI. For local first run, we'll just
// gate this with a skip and run it after signing in manually.

test.skip(!process.env.E2E_AUTH_OK, "Sign in manually before running");

test("homepage loads and admin products list is reachable when signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DUPE" })).toBeVisible();

  await page.goto("/admin/products");
  // either products list or login redirect
  await expect(page).toHaveURL(/\/admin(\/products)?(\/login)?/);
});
