import { expect, test } from "@playwright/test";

test("workspace board supports add, inspect, link, and remove flows", async ({ page }) => {
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3010";
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.goto(`${baseUrl}/workspace?projectId=proj-demo`);
  await expect(page.getByText("Campaign Board")).toBeVisible();
  await expect(page.getByText("Context Inspector")).toBeVisible();
  await expect(page.getByText("World intelligence")).toBeVisible();
  await expect(
    page.getByText(/Left signal rail: campaign pressure, prep signals, and GM notes/i)
  ).toBeVisible();

  await page.getByRole("button", { name: /Add/i }).click();
  await expect(page.getByText("Actors & Forces")).toBeVisible();
  await expect(page.getByRole("button", { name: "Actor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Faction" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Front" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Region" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Site" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Token" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Event" })).toBeVisible();

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const leftX = box!.x + 220;
  const upperY = box!.y + 180;
  const lowerY = box!.y + 300;

  await page.getByRole("button", { name: "Actor" }).click();
  await page.mouse.click(leftX, upperY);
  await page.mouse.click(leftX, upperY);
  await expect(page.getByText("Actor 1")).toBeVisible();
  await expect(page.getByText(/Manual agent node placed on the campaign board/i)).toBeVisible();

  await page.getByRole("button", { name: /Add/i }).click();
  await page.getByRole("button", { name: "Event" }).click();
  await page.mouse.click(leftX + 160, lowerY);
  await page.mouse.click(leftX + 160, lowerY);
  await expect(page.getByText("Event 1")).toBeVisible();

  await page.getByRole("button", { name: /Link Nodes/i }).click();
  await page.mouse.click(leftX, upperY);
  await page.mouse.click(leftX + 160, lowerY);

  await page.mouse.click(leftX, upperY);
  await expect(page.getByText("Actor 1")).toBeVisible();
  await expect(page.getByText("Event 1")).toBeVisible();
  await expect(page.getByText(/^causal$/i)).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(dialogs.length).toBeGreaterThan(0);
  await expect(page.getByText("Select something on the board")).toBeVisible();
});
