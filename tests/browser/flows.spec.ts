import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/en/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
}
test("catalogue and translated product details render without fake bonus claims", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByText("Test Adventure", { exact: true })).toBeVisible();
  await page.goto("/zh/games/30000000-0000-4000-8000-000000000001");
  await expect(page.getByText("测试冒险", { exact: true })).toBeVisible();
  await page.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("100 测试水晶");
  await expect(page.getByText("3x In-Game Bonus!")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("anonymous visitors cannot enter merchant or customer order pages", async ({
  page,
}) => {
  await page.goto("/en/dashboard/merchant");
  await expect(page).toHaveURL(/\/en\/auth/);
  await page.goto("/en/orders");
  await expect(page).toHaveURL(/\/en\/auth/);
});
test("buyer signs in, reads actual scoped orders, cannot enter admin, and signs out", async ({
  page,
}) => {
  await login(page, "buyer@example.test");
  await page.getByRole("link", { name: "My orders" }).click();
  await expect(
    page.getByText("50000000-0000-4000-8000-000000000001"),
  ).toBeVisible();
  await expect(
    page.getByText("Awaiting payment confirmation", { exact: true }),
  ).toBeVisible();
  await page.goto("/en/dashboard/admin");
  await expect(page).toHaveURL(/\/en$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("link", { name: "Login", exact: true }),
  ).toBeVisible();
});
test("merchant signs in and opens the scoped catalogue editor", async ({
  page,
}) => {
  await login(page, "merchant@example.test");
  await page.getByRole("link", { name: "Merchant portal" }).click();
  await expect(
    page.getByRole("heading", { name: "Merchant overview" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Games & products" }).click();
  await expect(page.getByLabel("English name").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Test Adventure" }),
  ).toBeVisible();
});
test("checkout remains closed until explicitly enabled and return page never invents payment success", async ({
  page,
}) => {
  await login(page, "buyer@example.test");
  await page.goto("/en/games/30000000-0000-4000-8000-000000000001");
  await page.getByRole("button").first().click();
  await page.getByLabel("Player account ID").fill("player-001");
  await page
    .getByLabel("Game server (enter N/A if not applicable)")
    .fill("EU-1");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Checkout is not available yet",
  );
  await page.goto("/en/payment/success?session_id=cs_fixture_pending");
  await expect(
    page.getByRole("heading", { name: "Awaiting payment confirmation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payment confirmed", exact: true }),
  ).toHaveCount(0);
});

test("forgot password requests email and reset requires a verified session", async ({
  page,
}) => {
  await page.goto("/en/auth");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("buyer@example.test");
  await page.getByRole("button", { name: "Send reset email" }).click();
  await expect(
    page.getByText(
      "If this email is registered, a reset email will arrive. Open its link in this browser.",
    ),
  ).toBeVisible();
  await page.goto("/en/auth/reset");
  await expect(page).toHaveURL(/\/en\/auth\/forgot/);
});

test("guest or buyer enters redeem page, redeems valid code, and views delivery receipt", async ({
  page,
}) => {
  await page.goto("/en/redeem");
  await expect(
    page.getByRole("heading", { name: "Redemption Center" }),
  ).toBeVisible();
  await page.getByPlaceholder("NX-XXXX-XXXX-XXXX").fill("NX-TEST-REDEEM-OK");
  await page.getByRole("button", { name: "Redeem Now" }).click();
  await expect(page).toHaveURL(
    /\/en\/orders\/50000000-0000-4000-8000-000000000002/,
  );
  await expect(page.getByText("FIXTURE_SECRET_DOWNLOAD_KEY")).toBeVisible();
});

test("merchant can reload saved codes and revoke an unused code", async ({
  page,
}) => {
  await login(page, "merchant@example.test");
  await page.goto("/en/dashboard/merchant/games");
  await page
    .getByRole("button", { name: "Generate Redeem Codes" })
    .first()
    .click();
  const row = page.getByRole("row").filter({ hasText: "NX-MANAGED-FIXTURE" });
  await expect(row).toContainText("active");
  await row.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(row).toContainText("disabled");
  await page.reload();
  await page
    .getByRole("button", { name: "Generate Redeem Codes" })
    .first()
    .click();
  await expect(row).toContainText("disabled");
  await expect(
    row.getByRole("button", { name: "Revoke", exact: true }),
  ).toHaveCount(0);
});
