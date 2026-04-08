# Canvas Testing Guide

This directory contains comprehensive Playwright tests for the canvas drag-and-drop functionality.

## Test Files

### `canvas-drag-drop.spec.ts`
Tests core drag and drop functionality:
- ✅ Drag nodes in Move mode without teleporting
- ✅ Prevent dragging in Inspect mode
- ✅ Preserve positions when switching modes
- ✅ Handle cluster expansion without teleporting
- ✅ **CRITICAL: No teleport after drag → mode switch → cluster expand** (main bug test)
- ✅ Drag multiple nodes sequentially
- ✅ Preserve dragged positions across multiple cluster expansions
- ✅ Handle drag → mode switch → expand → mode switch cycle
- ✅ Visual feedback during drag
- ✅ Rapid mode switching stability
- ✅ Node isolation during drag
- ✅ ESC key to cancel operations
- ✅ Correct cursor in different modes
- ✅ Performance with many nodes

### `canvas-ui-interactions.spec.ts`
Tests UI interactions and controls:
- ✅ Toolbar button functionality
- ✅ Keyboard shortcuts
- ✅ Add dropdown behavior
- ✅ Help panel toggle
- ✅ Quick actions on selection
- ✅ Fit/Reset view controls
- ✅ Connection mode workflow
- ✅ Link type selection
- ✅ Zoom controls
- ✅ Panning with mouse
- ✅ Accessibility features

### `workspace-board.spec.ts`
Original stability test for node dragging.

## Running Tests

### Run all canvas tests
```bash
npx playwright test tests/canvas-drag-drop.spec.ts tests/canvas-ui-interactions.spec.ts
```

### Run specific test file
```bash
npx playwright test tests/canvas-drag-drop.spec.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test tests/canvas-drag-drop.spec.ts --headed
```

### Run in debug mode
```bash
npx playwright test tests/canvas-drag-drop.spec.ts --debug
```

### Run specific test
```bash
npx playwright test -g "should drag node in Move mode"
```

### Run with UI mode (interactive)
```bash
npx playwright test --ui
```

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server should be running on `http://localhost:3001`

2. **Install Playwright browsers (first time only):**
   ```bash
   npx playwright install
   ```

## Environment Variables

Set `BASE_URL` to test against a different server:
```bash
BASE_URL=http://localhost:3000 npx playwright test
```

## Test Coverage

### Position Management
- ✅ Stable position cache system
- ✅ No teleporting on mode switch
- ✅ No teleporting on cluster expand
- ✅ Position persistence across layout changes
- ✅ Drag position priority hierarchy

### User Interactions
- ✅ Move mode (M) - drag nodes
- ✅ Inspect mode (I) - select/click nodes
- ✅ Connect mode (C) - create connections
- ✅ Delete mode (D) - remove nodes
- ✅ ESC to cancel operations

### Visual Feedback
- ✅ Scale-up animation on drag
- ✅ Glow effect during drag
- ✅ Cursor changes (grab/grabbing)
- ✅ Connection hints
- ✅ Zoom indicator

### Performance
- ✅ Smooth dragging with many nodes
- ✅ Fast mode switching
- ✅ No lag during interactions

## Debugging Failed Tests

### Take screenshots on failure
```bash
npx playwright test --screenshot=only-on-failure
```

### Record video
```bash
npx playwright test --video=retain-on-failure
```

### View test report
```bash
npx playwright show-report
```

### Inspect specific element
```bash
npx playwright codegen http://localhost:3001/workspace?projectId=proj-demo
```

## Writing New Tests

### Test Structure
```typescript
test("should do something", async ({ page }) => {
  // 1. Navigate and wait for canvas
  await page.goto(`${BASE_URL}/workspace?projectId=proj-demo`);
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.waitForTimeout(500);

  // 2. Perform actions
  await page.keyboard.press("m");
  const node = page.locator(".react-flow__node").first();
  
  // 3. Assert results
  await expect(node).toBeVisible();
});
```

### Best Practices
- Always wait for canvas to be visible
- Use `waitForTimeout` sparingly (prefer `waitFor` conditions)
- Get bounding boxes to verify positions
- Test both success and failure cases
- Clean up state between tests

## Common Issues

### Port already in use
If tests fail with "port in use", check:
```bash
# Find process on port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Flaky tests
- Increase wait times for slow machines
- Use `expect.poll()` for async conditions
- Check for race conditions in position updates

### Canvas not loading
- Verify dev server is running
- Check browser console for errors
- Ensure database is seeded with test data

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run Canvas Tests
  run: npx playwright test tests/canvas-*.spec.ts
  env:
    BASE_URL: http://localhost:3001
```

## Test Metrics

Current test coverage:
- **Drag & Drop**: 14 tests (including critical bug reproduction)
- **UI Interactions**: 20+ tests
- **Accessibility**: 3 tests
- **Performance**: 1 test

Total: **38+ comprehensive tests**

### Key Test Scenarios
1. **Basic drag operations** - Move mode dragging, Inspect mode clicking
2. **Position stability** - Mode switching, cluster expansion, layout changes
3. **Critical bug reproduction** - Drag → Inspect → Expand sequence
4. **Complex workflows** - Multi-step interactions, rapid switching
5. **Visual feedback** - Animations, cursors, highlights
6. **Performance** - Many nodes, rapid interactions
