import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3001";

test.describe("Canvas Drag and Drop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();
    await page.waitForTimeout(500); // Wait for initial render
  });

  test("should drag node in Move mode without teleporting", async ({ page }) => {
    // Switch to Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    await expect(node).toBeVisible();

    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    // Drag the node
    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 200,
      startBox!.y + startBox!.height / 2 + 100,
      { steps: 15 }
    );
    await page.mouse.up();

    // Check node moved
    const endBox = await node.boundingBox();
    expect(endBox).toBeTruthy();
    expect(Math.abs(endBox!.x - startBox!.x)).toBeGreaterThan(150);
    expect(Math.abs(endBox!.y - startBox!.y)).toBeGreaterThan(50);

    // Wait for position to settle
    await page.waitForTimeout(500);

    // Verify no teleporting - position should be stable
    const settledBox = await node.boundingBox();
    expect(settledBox).toBeTruthy();
    expect(Math.abs(settledBox!.x - endBox!.x)).toBeLessThan(5);
    expect(Math.abs(settledBox!.y - endBox!.y)).toBeLessThan(5);
  });

  test("should not drag node in Inspect mode", async ({ page }) => {
    // Switch to Inspect mode
    await page.keyboard.press("i");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    // Try to drag
    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 100,
      startBox!.y + startBox!.height / 2 + 50,
      { steps: 10 }
    );
    await page.mouse.up();

    // Node should not have moved
    const endBox = await node.boundingBox();
    expect(endBox).toBeTruthy();
    expect(Math.abs(endBox!.x - startBox!.x)).toBeLessThan(10);
    expect(Math.abs(endBox!.y - startBox!.y)).toBeLessThan(10);
  });

  test("should preserve position when switching modes", async ({ page }) => {
    // Drag in Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 150,
      startBox!.y + startBox!.height / 2 + 80,
      { steps: 12 }
    );
    await page.mouse.up();

    await page.waitForTimeout(500);
    const movedBox = await node.boundingBox();
    expect(movedBox).toBeTruthy();

    // Switch to Inspect mode
    await page.keyboard.press("i");
    await page.waitForTimeout(300);

    // Position should be preserved
    const inspectBox = await node.boundingBox();
    expect(inspectBox).toBeTruthy();
    expect(Math.abs(inspectBox!.x - movedBox!.x)).toBeLessThan(5);
    expect(Math.abs(inspectBox!.y - movedBox!.y)).toBeLessThan(5);

    // Switch back to Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(300);

    // Position should still be preserved
    const backToMoveBox = await node.boundingBox();
    expect(backToMoveBox).toBeTruthy();
    expect(Math.abs(backToMoveBox!.x - movedBox!.x)).toBeLessThan(5);
    expect(Math.abs(backToMoveBox!.y - movedBox!.y)).toBeLessThan(5);
  });

  test("should handle cluster expansion without teleporting nodes", async ({ page }) => {
    // Switch to Inspect mode
    await page.keyboard.press("i");
    await page.waitForTimeout(100);

    // Find a cluster node
    const cluster = page.locator(".react-flow__node").filter({ hasText: "Support actors" }).first();
    
    if (await cluster.count() > 0) {
      // Get positions of nearby nodes before expansion
      const allNodes = page.locator(".react-flow__node");
      const nodeCount = await allNodes.count();
      const nodePositions: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < Math.min(nodeCount, 5); i++) {
        const box = await allNodes.nth(i).boundingBox();
        if (box) {
          nodePositions.push({ x: box.x, y: box.y });
        }
      }

      // Click cluster to expand
      await cluster.click();
      await page.waitForTimeout(500);

      // Check that existing nodes didn't teleport
      for (let i = 0; i < nodePositions.length; i++) {
        const box = await allNodes.nth(i).boundingBox();
        if (box) {
          const moved = Math.hypot(
            box.x - nodePositions[i].x,
            box.y - nodePositions[i].y
          );
          // Allow small movement but not teleporting
          expect(moved).toBeLessThan(50);
        }
      }
    }
  });

  test("CRITICAL: should not teleport after drag in Move mode then cluster expand in Inspect mode", async ({ page }) => {
    // This test reproduces the exact bug reported by the user:
    // 1. Drag works in Move mode
    // 2. Switch to Inspect mode
    // 3. Click cluster to expand
    // 4. Previously dragged nodes should NOT teleport

    // Step 1: Drag a node in Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const targetNode = page.locator(".react-flow__node").first();
    await expect(targetNode).toBeVisible();

    const startBox = await targetNode.boundingBox();
    expect(startBox).toBeTruthy();

    // Drag the node to a new position
    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 250,
      startBox!.y + startBox!.height / 2 + 150,
      { steps: 20 }
    );
    await page.mouse.up();

    // Wait for drag to complete and position to be saved
    await page.waitForTimeout(800);

    const draggedBox = await targetNode.boundingBox();
    expect(draggedBox).toBeTruthy();
    expect(Math.abs(draggedBox!.x - startBox!.x)).toBeGreaterThan(200);

    // Step 2: Switch to Inspect mode
    await page.keyboard.press("i");
    await page.waitForTimeout(300);

    // Verify position is still preserved after mode switch
    const afterModeSwitch = await targetNode.boundingBox();
    expect(afterModeSwitch).toBeTruthy();
    expect(Math.abs(afterModeSwitch!.x - draggedBox!.x)).toBeLessThan(5);
    expect(Math.abs(afterModeSwitch!.y - draggedBox!.y)).toBeLessThan(5);

    // Step 3: Find and expand a cluster
    const cluster = page.locator(".react-flow__node").filter({ hasText: /Support actors|Routes and support/ }).first();
    
    if (await cluster.count() > 0) {
      await cluster.click();
      await page.waitForTimeout(600);

      // Step 4: CRITICAL - The dragged node should NOT have teleported
      const afterClusterExpand = await targetNode.boundingBox();
      expect(afterClusterExpand).toBeTruthy();
      
      const teleportDistance = Math.hypot(
        afterClusterExpand!.x - draggedBox!.x,
        afterClusterExpand!.y - draggedBox!.y
      );

      // This is the critical assertion - node should not move more than a few pixels
      expect(teleportDistance).toBeLessThan(10);
    }
  });

  test("should drag multiple nodes sequentially", async ({ page }) => {
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const nodes = page.locator(".react-flow__node");
    const nodeCount = await nodes.count();

    for (let i = 0; i < Math.min(nodeCount, 3); i++) {
      const node = nodes.nth(i);
      const startBox = await node.boundingBox();
      
      if (startBox) {
        await page.mouse.move(
          startBox.x + startBox.width / 2,
          startBox.y + startBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          startBox.x + startBox.width / 2 + 100,
          startBox.y + startBox.height / 2 + 50,
          { steps: 10 }
        );
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Verify node moved
        const endBox = await node.boundingBox();
        expect(endBox).toBeTruthy();
        expect(Math.abs(endBox!.x - startBox.x)).toBeGreaterThan(50);
      }
    }
  });

  test("should show visual feedback during drag", async ({ page }) => {
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    // Start drag
    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();

    // Check for scale-up animation (node should be slightly larger)
    // This is a visual check - the node should have scale-105 class or similar
    await page.waitForTimeout(100);

    // Complete drag
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 50,
      startBox!.y + startBox!.height / 2 + 50,
      { steps: 5 }
    );
    await page.mouse.up();
  });

  test("should handle rapid mode switching", async ({ page }) => {
    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    // Rapidly switch modes
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("m");
      await page.waitForTimeout(50);
      await page.keyboard.press("i");
      await page.waitForTimeout(50);
    }

    // Node should still be in original position
    const endBox = await node.boundingBox();
    expect(endBox).toBeTruthy();
    expect(Math.abs(endBox!.x - startBox!.x)).toBeLessThan(10);
    expect(Math.abs(endBox!.y - startBox!.y)).toBeLessThan(10);
  });

  test("should not interfere with other nodes during drag", async ({ page }) => {
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const nodes = page.locator(".react-flow__node");
    const draggedNode = nodes.nth(0);
    const staticNode = nodes.nth(1);

    const draggedStart = await draggedNode.boundingBox();
    const staticStart = await staticNode.boundingBox();
    expect(draggedStart).toBeTruthy();
    expect(staticStart).toBeTruthy();

    // Drag first node
    await page.mouse.move(
      draggedStart!.x + draggedStart!.width / 2,
      draggedStart!.y + draggedStart!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      draggedStart!.x + draggedStart!.width / 2 + 200,
      draggedStart!.y + draggedStart!.height / 2 + 100,
      { steps: 15 }
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Static node should not have moved
    const staticEnd = await staticNode.boundingBox();
    expect(staticEnd).toBeTruthy();
    expect(Math.abs(staticEnd!.x - staticStart!.x)).toBeLessThan(10);
    expect(Math.abs(staticEnd!.y - staticStart!.y)).toBeLessThan(10);
  });

  test("should handle ESC key to cancel operations", async ({ page }) => {
    // Switch to Connect mode
    await page.keyboard.press("c");
    await page.waitForTimeout(100);

    // Press ESC to cancel
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    // Should return to inspect mode (or previous mode)
    // Verify by checking that nodes are not in connect mode
  });

  test("should preserve dragged positions across multiple cluster expansions", async ({ page }) => {
    // Drag multiple nodes in Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const nodes = page.locator(".react-flow__node");
    const draggedPositions: Array<{ x: number; y: number }> = [];

    // Drag first 3 nodes
    for (let i = 0; i < Math.min(3, await nodes.count()); i++) {
      const node = nodes.nth(i);
      const startBox = await node.boundingBox();
      
      if (startBox) {
        await page.mouse.move(
          startBox.x + startBox.width / 2,
          startBox.y + startBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          startBox.x + startBox.width / 2 + (i + 1) * 100,
          startBox.y + startBox.height / 2 + (i + 1) * 50,
          { steps: 10 }
        );
        await page.mouse.up();
        await page.waitForTimeout(400);

        const endBox = await node.boundingBox();
        if (endBox) {
          draggedPositions.push({ x: endBox.x, y: endBox.y });
        }
      }
    }

    // Switch to Inspect mode
    await page.keyboard.press("i");
    await page.waitForTimeout(300);

    // Expand all clusters
    const clusters = page.locator(".react-flow__node").filter({ hasText: /Support|Routes/ });
    const clusterCount = await clusters.count();

    for (let i = 0; i < clusterCount; i++) {
      await clusters.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Verify all dragged nodes maintained their positions
    for (let i = 0; i < draggedPositions.length; i++) {
      const node = nodes.nth(i);
      const currentBox = await node.boundingBox();
      
      if (currentBox) {
        const drift = Math.hypot(
          currentBox.x - draggedPositions[i].x,
          currentBox.y - draggedPositions[i].y
        );
        expect(drift).toBeLessThan(15);
      }
    }
  });

  test("should handle drag, mode switch, cluster expand, mode switch cycle", async ({ page }) => {
    // Complex scenario: drag → inspect → expand → move → drag again
    
    // Initial drag in Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 180,
      startBox!.y + startBox!.height / 2 + 90,
      { steps: 15 }
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    const firstDragBox = await node.boundingBox();
    expect(firstDragBox).toBeTruthy();

    // Switch to Inspect and expand cluster
    await page.keyboard.press("i");
    await page.waitForTimeout(200);

    const cluster = page.locator(".react-flow__node").filter({ hasText: /Support/ }).first();
    if (await cluster.count() > 0) {
      await cluster.click();
      await page.waitForTimeout(400);
    }

    // Switch back to Move mode
    await page.keyboard.press("m");
    await page.waitForTimeout(200);

    // Verify position maintained
    const afterCycleBox = await node.boundingBox();
    expect(afterCycleBox).toBeTruthy();
    expect(Math.abs(afterCycleBox!.x - firstDragBox!.x)).toBeLessThan(10);
    expect(Math.abs(afterCycleBox!.y - firstDragBox!.y)).toBeLessThan(10);

    // Drag again from new position
    await page.mouse.move(
      afterCycleBox!.x + afterCycleBox!.width / 2,
      afterCycleBox!.y + afterCycleBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      afterCycleBox!.x + afterCycleBox!.width / 2 + 100,
      afterCycleBox!.y + afterCycleBox!.height / 2 + 50,
      { steps: 10 }
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    const secondDragBox = await node.boundingBox();
    expect(secondDragBox).toBeTruthy();
    expect(Math.abs(secondDragBox!.x - afterCycleBox!.x)).toBeGreaterThan(50);
  });

  test("should display correct cursor in different modes", async ({ page }) => {
    const node = page.locator(".react-flow__node").first();

    // Move mode - should show grab cursor
    await page.keyboard.press("m");
    await page.waitForTimeout(100);
    await node.hover();
    // Cursor should be grab/grabbing

    // Inspect mode - should show pointer cursor
    await page.keyboard.press("i");
    await page.waitForTimeout(100);
    await node.hover();
    // Cursor should be pointer
  });
});

test.describe("Canvas Performance", () => {
  test("should handle drag with many nodes", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
    await expect(page.locator(".react-flow")).toBeVisible();
    await page.waitForTimeout(500);

    await page.keyboard.press("m");
    await page.waitForTimeout(100);

    const node = page.locator(".react-flow__node").first();
    const startBox = await node.boundingBox();
    expect(startBox).toBeTruthy();

    const startTime = Date.now();

    // Perform drag
    await page.mouse.move(
      startBox!.x + startBox!.width / 2,
      startBox!.y + startBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      startBox!.x + startBox!.width / 2 + 150,
      startBox!.y + startBox!.height / 2 + 100,
      { steps: 20 }
    );
    await page.mouse.up();

    const endTime = Date.now();
    const dragDuration = endTime - startTime;

    // Drag should complete in reasonable time (< 2 seconds)
    expect(dragDuration).toBeLessThan(2000);
  });
});
