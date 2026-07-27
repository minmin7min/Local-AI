import { expect, test, type Page } from "@playwright/test";

const demoPassword = "Synthetic-Demo-Only-Change-Me!";

async function signIn(page: Page, tenantSlug: string, email: string) {
  await page.goto("/");
  const loginForm = page.locator("#login-form");
  await loginForm.getByLabel("Company workspace").fill(tenantSlug);
  await loginForm.getByLabel("Work email").fill(email);
  await loginForm.getByLabel("Password", { exact: true }).fill(demoPassword);
  await loginForm.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

test("the full demo exposes the core owner workflows", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the full demo/ }).click();

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  for (const name of ["Overview", "People", "Policies", "Ask AI", "Deadlines", "Notifications", "Import", "Administration"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Authorized people" })).toBeVisible();
  await expect(page.getByText("Avery Morgan")).toBeVisible();
  await page.locator(".employee-row", { hasText: "Avery Morgan" }).getByRole("button", { name: "View record" }).click();
  await expect(page.getByRole("heading", { name: "Operational record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certifications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();

  await page.getByRole("button", { name: "Administration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tenant administration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Users and roles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent audit events" })).toBeVisible();
});

test("policy answers are grounded in an approved tenant source", async ({ page }) => {
  await signIn(page, "northstar", "avery.morgan@northstar.example.invalid");
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.getByLabel("Question").fill("I am sick and cannot work today. What should I do?");
  await page.getByRole("button", { name: "Find an approved answer" }).click();

  await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
  await expect(page.locator("#answer .answer")).toContainText("contact their manager before the scheduled shift");
  await expect(page.getByText("1 approved source(s)")).toBeVisible();
});

test("an administrator can invite a user who securely activates their own account", async ({ page, browser }) => {
  const email = `browser.invitee.${Date.now()}@northstar.example.invalid`;
  const password = "Synthetic-Browser-Invite-Password!";
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the full demo/ }).click();
  await page.getByRole("button", { name: "Administration", exact: true }).click();
  const invitationForm = page.locator("#member-form");
  await invitationForm.getByLabel("Display name").fill("Browser Invitee");
  await invitationForm.getByLabel("Work email").fill(email);
  await invitationForm.getByRole("button", { name: "Create secure invitation" }).click();
  const setupLink = invitationForm.locator(".form-status a");
  await expect(setupLink).toBeVisible();
  const setupUrl = await setupLink.getAttribute("href");
  expect(setupUrl).toBeTruthy();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(setupUrl!);
  await expect(recipientPage.getByRole("heading", { name: "Set up your invited account" })).toBeVisible();
  await expect(recipientPage.locator("#invite-summary")).toContainText("Browser Invitee");
  await recipientPage.getByLabel("Create password").fill(password);
  await recipientPage.getByLabel("Confirm password").fill(password);
  await recipientPage.getByRole("button", { name: "Activate account" }).click();

  await expect(recipientPage.getByText("Account activated. Sign in with your new password.")).toBeVisible();
  const loginForm = recipientPage.locator("#login-form");
  await expect(loginForm.getByLabel("Company workspace")).toHaveValue("northstar");
  await expect(loginForm.getByLabel("Work email")).toHaveValue(email);
  await loginForm.getByLabel("Password", { exact: true }).fill(password);
  await loginForm.getByRole("button", { name: "Sign in securely" }).click();
  await expect(recipientPage.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(recipientPage.getByRole("button", { name: "Administration", exact: true })).toBeHidden();
  await recipientContext.close();
});

test("an employee sees only their authorized tenant scope", async ({ page }) => {
  await signIn(page, "cedar", "avery.morgan@cedar.example.invalid");

  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Administration", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByText("Property Technician")).toBeVisible();
  await expect(page.getByText("Cafe Associate")).toHaveCount(0);

  const crossTenantAttempt = await page.evaluate(async () => {
    const response = await fetch("/api/employees/13000000-0000-4000-8000-000000000001/operations");
    return { status: response.status, body: await response.text() };
  });
  expect([403, 404]).toContain(crossTenantAttempt.status);
  expect(crossTenantAttempt.body).not.toContain("Northstar");
  expect(crossTenantAttempt.body).not.toContain("Cafe Associate");
});
