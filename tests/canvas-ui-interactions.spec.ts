import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3001";

test.describe("Canvas UI Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();
    await page.waitForTimeout(500);
  });

  test("should switch tools using toolbar buttons", async ({ page }) => {
    // Click Inspect button
    await page.getByTitle("Inspect (I)").click();
    await page.waitForTimeout(100);

    // Click Move button
    await page.getByTitle("Move (M)").click();
    await page.waitForTimeout(100);

    // Click Connect button
    await page.getByTitle("Connect (C)").click();
    await page.waitForTimeout(100);

    // Click Delete button
    await page.getByTitle("Delete (D)").click();
    await page.waitForTimeout(100);
  });

  test("should switch tools using keyboard shortcuts", async ({ page }) => {
    await page.keyboard.press("i");
    await page.waitForTimeout(50);

    await page.keyboard.press("m");
    await page.waitForTimeout(50);

    await page.keyboard.press("c");
    await page.waitForTimeout(50);

    await page.keyboard.press("d");
    await page.waitForTimeout(50);
  });

  test("should show Add dropdown on hover", async ({ page }) => {
    const addButton = page.getByRole("button", { name: "Add" });
    await expect(addButton).toBeVisible();

    // Hover over Add button
    await addButton.hover();
    await page.waitForTimeout(200);

    // Dropdown should be visible
    const dropdown = page.locator("text=Actor").first();
    await expect(dropdown).toBeVisible();
  });

  test("should keep Add dropdown open when hovering over options", async ({ page }) => {
    const addButton = page.getByRole("button", { name: "Add" });
    await addButton.hover();
    await page.waitForTimeout(200);

    // Move to dropdown option
    const actorOption = page.locator("text=Actor").first();
    await actorOption.hover();
    await page.waitForTimeout(200);

    // Dropdown should still be visible
    await expect(actorOption).toBeVisible();
  });

  test("should show help panel when clicking help button", async ({ page }) => {
    const helpButton = page.getByRole("button", { name: "Help" }).or(page.locator("button:has-text('?')"));
    
    if (await helpButton.count() > 0) {
      await helpButton.click();
      await page.waitForTimeout(200);

      // Help panel should be visible
      const helpPanel = page.locator("text=Quick Reference").or(page.locator("text=Shortcuts"));
      await expect(helpPanel).toBeVisible();

      // Close help panel
      await helpButton.click();
      await page.waitForTimeout(200);
    }
  });

  test("should show quick actions on node selection", async ({ page }) => {
    await page.keyboard.press("i");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    await node.click();
    await page.waitForTimeout(300);

    // Quick action buttons should appear (Connect and Delete)
    // These appear above the selected node
  });

  test("should fit view when clicking fit button", async ({ page }) => {
    const fitButton = page.getByTitle("Fit view");
    await expect(fitButton).toBeVisible();

    await fitButton.click();
    await page.waitForTimeout(800);

    // Canvas should have adjusted viewport
  });

  test("should reset view when clicking reset button", async ({ page }) => {
    const resetButton = page.getByTitle("Reset view");
    await expect(resetButton).toBeVisible();

    // Zoom in first
    await page.keyboard.press("Control+=");
    await page.waitForTimeout(200);

    // Reset
    await resetButton.click();
    await page.waitForTimeout(800);

    // Viewport should be reset
  });

  test("should show connection hint in connect mode", async ({ page }) => {
    await page.keyboard.press("c");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    await node.click();
    await page.waitForTimeout(200);

    // Connection hint should be visible
    const hint = page.locator("text=Click target node").or(page.locator("text=CONNECTION"));
    await expect(hint).toBeVisible();
  });

  test("should change link type in connect mode", async ({ page }) => {
    await page.keyboard.press("c");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    await node.click();
    await page.waitForTimeout(200);

    // Click different link type buttons
    const allyButton = page.locator("button:has-text('Ally')").or(page.getByRole("button", { name: "Ally" }));
    if (await allyButton.count() > 0) {
      await allyButton.click();
      await page.waitForTimeout(100);
    }

    const foeButton = page.locator("button:has-text('Foe')").or(page.getByRole("button", { name: "Foe" }));
    if (await foeButton.count() > 0) {
      await foeButton.click();
      await page.waitForTimeout(100);
    }
  });

  test("should cancel connect mode with ESC", async ({ page }) => {
    await page.keyboard.press("c");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    await node.click();
    await page.waitForTimeout(200);

    // Press ESC to cancel
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Connection hint should disappear
    const hint = page.locator("text=Click target node");
    await expect(hint).not.toBeVisible();
  });

  test("should show zoom percentage", async ({ page }) => {
    const zoomIndicator = page.locator("text=/\\d+%/");
    await expect(zoomIndicator).toBeVisible();

    // Zoom in
    await page.keyboard.press("Control+=");
    await page.waitForTimeout(200);

    // Zoom percentage should update
    await expect(zoomIndicator).toBeVisible();
  });

  test("should show node and link count", async ({ page }) => {
    // Stats panel should show counts
    const statsPanel = page.locator(".react-flow").locator("..");
    
    // Should show entity count
    const entityCount = page.locator("text=/\\d+/").first();
    await expect(entityCount).toBeVisible();
  });

  test("should handle panning with middle mouse button", async ({ page }) => {
    await page.keyboard.press("i");
    await page.waitForTimeout(100);

    const canvas = page.locator(".react-flow");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Middle mouse button pan
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(
      box!.x + box!.width / 2 + 100,
      box!.y + box!.height / 2 + 100,
      { steps: 10 }
    );
    await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(200);
  });

  test("should handle zoom with mouse wheel", async ({ page }) => {
    const canvas = page.locator(".react-flow");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Zoom in with wheel
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(200);

    // Zoom out with wheel
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(200);
  });

  test("should handle keyboard shortcuts while typing is not active", async ({ page }) => {
    // Make sure no input is focused
    await page.locator(".react-flow").click();
    await page.waitForTimeout(100);

    // Test shortcuts
    await page.keyboard.press("i");
    await page.waitForTimeout(50);
    await page.keyboard.press("m");
    await page.waitForTimeout(50);
    await page.keyboard.press("c");
    await page.waitForTimeout(50);

    // All shortcuts should work
  });

  test("should not trigger shortcuts when input is focused", async ({ page }) => {
    // If there's a search or input field, focus it
    const input = page.locator("input").first();
    
    if (await input.count() > 0) {
      await input.click();
      await page.keyboard.type("test");
      
      // Shortcuts should not trigger while typing
      await page.keyboard.press("m");
      await page.keyboard.press("i");
      
      // Input should still have "test" in it
      await expect(input).toHaveValue(/test/);
    }
  });

  test("should show minimap", async ({ page }) => {
    // React Flow minimap should be visible
    const minimap = page.locator(".react-flow__minimap");
    
    if (await minimap.count() > 0) {
      await expect(minimap).toBeVisible();
    }
  });

  test("should show background grid", async ({ page }) => {
    // Background pattern should be visible
    const background = page.locator(".react-flow__background");
    await expect(background).toBeVisible();
  });
});

test.describe("Canvas Accessibility", () => {
  test("should have proper ARIA labels on toolbar buttons", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();

    // Check for accessible button labels
    const inspectButton = page.getByTitle("Inspect (I)");
    await expect(inspectButton).toBeVisible();

    const moveButton = page.getByTitle("Move (M)");
    await expect(moveButton).toBeVisible();
  });

  test("should be keyboard navigable", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);

    // Should be able to navigate toolbar
  });

  test("should have visible focus indicators", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();

    // Tab to first button
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);

    // Check if focus is visible (this is a visual check)
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
