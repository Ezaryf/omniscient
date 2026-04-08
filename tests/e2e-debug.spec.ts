import { test, expect } from "@playwright/test";

test("debug simulation creation and navigation", async ({ page }) => {
  test.setTimeout(90000);
  const baseUrl = "http://localhost:3000";
  
  // Log console messages from the page
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
    else console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`PAGE FATAL ERROR: ${err.message}`));
  
  // 1. Go to dashboard
  console.log("Navigating to dashboard...");
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState('networkidle');
  
  // 2. Open modal
  console.log("Waiting for hydration...");
  await page.waitForTimeout(3000); // Give it plenty of time
  
  const newSimButton = page.locator('button:has-text("New Simulation")');
  const buttonBox = await newSimButton.boundingBox();
  console.log("Button box:", buttonBox);
  
  if (buttonBox) {
    console.log("Clicking New Simulation at:", buttonBox.x + buttonBox.width/2, buttonBox.y + buttonBox.height/2);
    await page.mouse.click(buttonBox.x + buttonBox.width/2, buttonBox.y + buttonBox.height/2);
  } else {
    console.log("Button box not found, trying standard click...");
    await newSimButton.click({ force: true });
  }
  
  // 3. Fill modal
  console.log("Waiting for dialog...");
  const dialog = page.getByRole('dialog').or(page.getByText(/Forge a fresh timeline/i));
  await expect(dialog.first()).toBeVisible({ timeout: 15000 });
  
  console.log("Filling form...");
  await page.getByLabel(/^Title$/i).fill("E2E Test Simulation " + Date.now());
  await page.getByLabel(/Scenario premise/i).fill("A debug simulation for E2E testing.");
  
  // 4. Submit
  console.log("Submitting modal...");
  const submitButton = page.getByRole('button', { name: /Create & Setup/i });
  await submitButton.click();
  
  // 5. Wait for navigation to workspace
  console.log("Waiting for workspace navigation...");
  await page.waitForURL(/\/workspace\b/, { timeout: 30000 });
  console.log("Navigated to:", page.url());
  
  // 6. Stabilize Workspace
  console.log("Waiting for workspace stabilization...");
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Extra time to avoid "Failed to fetch" race conditions
  
  // 7. Interact with Canvas
  console.log("Switching to Add Actor tool...");
  const addActorButton = page.getByLabel("Add actor");
  await expect(addActorButton).toBeVisible({ timeout: 15000 });
  await addActorButton.click();
  
  console.log("Placing Actor at (400, 400)...");
  await page.mouse.click(400, 400);
  await page.waitForTimeout(500);
  
  console.log("Switching to Add Event tool...");
  const addEventButton = page.getByLabel("Add event");
  await addEventButton.click();
  
  console.log("Placing Event at (600, 400)...");
  await page.mouse.click(600, 400);
  await page.waitForTimeout(500);
  
  console.log("Switching to Link tool...");
  const linkToolButton = page.getByLabel(/Link nodes/i);
  await linkToolButton.click();
  
  console.log("Linking nodes...");
  // Click first node (approx 400, 400)
  await page.mouse.click(400, 400);
  await page.waitForTimeout(300);
  // Click second node (approx 600, 400)
  await page.mouse.click(600, 400);
  
  await page.screenshot({ path: 'test-results/debug_workspace_final.png' });
  console.log("Debug test complete.");
});
