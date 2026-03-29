import { test, expect } from "@playwright/test";

test("create and exercise a simulation end to end", async ({ page }) => {
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(`${baseUrl}/`);
  await expect(page.getByRole("heading", { name: /GM Consequence/i })).toBeVisible();

  await page.getByRole("button", { name: /\+ New Simulation|New Simulation/i }).click();
  await expect(page.getByRole("heading", { name: /Forge a fresh timeline/i })).toBeVisible();
  await page.getByLabel("Simulation Name").fill("Sun Wu King VS Zeus");
  await page.getByLabel("Short Description").fill("A mythic trial of pride, thunder, and divine consequence.");
  await page.getByRole("button", { name: /Open Campaign Setup/i }).click();

  await page.waitForURL(/\/workspace\?projectId=/);
  const workspaceUrl = new URL(page.url());
  const projectId = workspaceUrl.searchParams.get("projectId");
  expect(projectId).toBeTruthy();

  await expect(page.getByText(/Campaign Setup/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Launch Timeline/i })).toBeVisible();
  await page.getByRole("button", { name: /Launch Timeline/i }).click();
  await expect(page.getByRole("button", { name: /Launch Timeline/i })).toBeHidden();
  await expect(page.getByText(/Campaign Consequence Map/i)).toBeVisible();
  await page.getByRole("button", { name: /Inject Consequence/i }).click();
  await expect(page.getByRole("heading", { name: /Inject Causal Event/i })).toBeVisible();
  await page.getByLabel("Description").fill("Zeus hurls a thunderbolt that shatters the mountain gate guarding Sun Wu King.");
  await page.getByRole("button", { name: /Inject Reality/i }).click();
  await expect(page.getByRole("heading", { name: /Inject Causal Event/i })).toBeHidden();

  await page.getByRole("button", { name: /Branch Now/i }).click();
  await expect(page.getByRole("heading", { name: /Branch Timeline/i })).toBeVisible();
  await page.getByLabel("Branch Name").fill("Wrath of Olympus");
  await page.getByLabel("Strategic Context").fill("A fork where divine retaliation escalates immediately.");
  await page.getByRole("button", { name: /Confirm Branch/i }).click();
  await expect(page.locator("#branch-select option")).toHaveCount(2);

  await page.getByRole("link", { name: /Compare/i }).click();
  await page.waitForURL(/\/compare\?/);
  await expect(page.getByRole("heading", { name: /Timeline Divergence Inspector/i })).toBeVisible();
  await page.getByRole("button", { name: /^Compare$/i }).click();
  await expect(
    page.getByText(/No Divergence Yet|Key Consequences|Front Divergence|Route Consequences/i).first()
  ).toBeVisible();

  await page.goto(`${baseUrl}/insights?projectId=${projectId}`);
  await expect(page.getByRole("heading", { name: /GM Insights/i })).toBeVisible();
  await expect(page.locator("#branch-select")).toBeVisible();

  await page.goto(`${baseUrl}/dashboard`);
  await expect(page.getByRole("heading", { name: /Command your branching worlds/i })).toBeVisible();
  await expect(page.getByText("Sun Wu King VS Zeus")).toBeVisible();

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(
    consoleErrors.filter(
      (entry) =>
        !entry.includes("favicon") &&
        !entry.includes("Source map") &&
        !entry.includes("Extension context invalidated") &&
        !entry.includes("webpack-hmr")
    ),
    `Console errors: ${consoleErrors.join("\n")}`
  ).toEqual([]);
});
