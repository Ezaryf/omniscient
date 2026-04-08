# Canvas Drag & Drop Teleporting Bug - Fix Summary

## Problem Description

Nodes were teleporting when:
1. User drags a node in Move mode (M)
2. User switches to Inspect mode (I)
3. User clicks a cluster to expand it
4. Previously dragged nodes jump to incorrect positions

## Root Cause Analysis

### The Position Management System

The canvas uses multiple position sources with a priority system:
1. `pendingNodePositionsRef` - Active drag positions
2. `stableNodePositionsRef` - Cached positions for dragged nodes
3. `structuredLayoutPositions` - Auto-calculated layout positions
4. `campaignLayoutPositions` - Campaign-specific layouts
5. Base entity positions - Original data positions

### The Bug Flow

1. **User drags node in Move mode:**
   - Position stored in `stableNodePositionsRef` ✅
   - Node ID added to `suppressedStructuredLayoutIds` ✅
   - This prevents `layoutExpandedMembers()` from overwriting the position

2. **User switches to Inspect mode:**
   - Mode changes, but positions preserved ✅

3. **User expands cluster:**
   - `expandedClusterIds` changes
   - `displayModel` memo recalculates (has `expandedClusterIds` in deps)
   - `layoutExpandedMembers()` runs and creates NEW `structuredLayoutPositions` Map
   - Even though suppressed IDs prevent writing, the Map is recreated

4. **The teleport happens:**
   - `baseNodes` recalculates via `useCanvasNodes`
   - `positionFor()` function checks positions in this order:
     ```typescript
     if (structuredLayoutPositions.has(nodeId)) {
       return structuredLayoutPositions.get(nodeId); // ❌ WRONG!
     }
     return flowPosition(...); // Never reaches stable cache
     ```
   - The `structuredLayoutPositions` Map has the node (from before drag)
   - It returns the OLD auto-layout position instead of the dragged position
   - Position sync effect uses these wrong positions from `baseNodes`

### Why Suppression Didn't Work

The `suppressedStructuredLayoutIds` prevented WRITING new positions to the Map, but didn't prevent READING old positions from it. The Map still contained pre-drag positions that were never removed.

## The Fix

### Changes Made

**1. Updated `useCanvasNodes.ts` interface:**
```typescript
interface UseCanvasNodesProps {
  // ... existing props
  suppressedStructuredLayoutIds: Set<string>; // NEW
}
```

**2. Fixed `positionFor()` function:**
```typescript
const positionFor = (position: Position, nodeId?: string, campaignOnly = false) => {
  // CRITICAL FIX: Skip structuredLayoutPositions for manually dragged nodes
  if (nodeId && suppressedStructuredLayoutIds.has(nodeId)) {
    return position; // Use base position (will be overridden by stable cache)
  }
  
  if (nodeId && structuredLayoutPositions?.has(nodeId)) {
    return structuredLayoutPositions.get(nodeId)!;
  }
  return flowPosition(position, campaignOnly ? campaignLayoutPositions : undefined, nodeId);
};
```

**3. Passed suppressedStructuredLayoutIds to useCanvasNodes:**
```typescript
const baseNodes = useCanvasNodes({
  // ... existing props
  suppressedStructuredLayoutIds, // NEW
});
```

### How It Works Now

1. User drags node → added to `suppressedStructuredLayoutIds`
2. Cluster expands → `structuredLayoutPositions` recalculates
3. `positionFor()` checks if node is suppressed FIRST
4. If suppressed, returns base position (ignored anyway)
5. Position sync effect uses `stableNodePositionsRef` instead
6. Node stays in dragged position ✅

## Position Priority (After Fix)

```
1. pendingNodePositionsRef (during active drag)
2. stableNodePositionsRef (for dragged nodes)
3. suppressedStructuredLayoutIds check (skip auto-layout)
4. structuredLayoutPositions (auto-layout)
5. campaignLayoutPositions (campaign layout)
6. base position (fallback)
```

## Testing

### New Tests Added

**Critical Bug Reproduction Test:**
```typescript
test("CRITICAL: should not teleport after drag in Move mode then cluster expand in Inspect mode")
```
This test specifically reproduces the exact bug scenario:
- Drag node in Move mode
- Switch to Inspect mode
- Expand cluster
- Assert node didn't teleport (< 10px movement)

**Additional Tests:**
- `should preserve dragged positions across multiple cluster expansions`
- `should handle drag, mode switch, cluster expand, mode switch cycle`

### Test Coverage

- 14 drag & drop tests
- 20+ UI interaction tests
- 38+ total comprehensive tests

### Running Tests

```bash
# Start dev server first
npm run dev

# Run all tests
npx playwright test

# Run critical test only
npx playwright test -g "CRITICAL"

# Run with UI
npx playwright test --ui
```

## Files Modified

1. `components/workspace/useCanvasNodes.ts`
   - Added `suppressedStructuredLayoutIds` prop
   - Fixed `positionFor()` to check suppression first

2. `components/workspace/react-flow-world-canvas.tsx`
   - Passed `suppressedStructuredLayoutIds` to `useCanvasNodes`

3. `tests/canvas-drag-drop.spec.ts`
   - Added critical bug reproduction test
   - Added complex scenario tests

4. `tests/README.md`
   - Updated test documentation
   - Added new test descriptions

## Verification

To verify the fix works:

1. Open canvas in browser
2. Press `M` to enter Move mode
3. Drag any node to a new position
4. Press `I` to enter Inspect mode
5. Click "Support actors" or "Routes and support" cluster
6. Verify the dragged node stays in place (no teleporting)

## Future Improvements

1. Consider removing nodes from `structuredLayoutPositions` Map when added to suppression set
2. Add visual indicator showing which nodes have manual positions
3. Add "Reset position" button to clear manual positions
4. Consider persisting suppression state across page reloads
5. Add telemetry to track how often users manually position nodes

## Related Issues

- Initial drag teleporting (fixed in previous iteration)
- Mode switching position loss (fixed in previous iteration)
- Cluster expansion teleporting (fixed in this iteration)

## Performance Impact

Minimal - only adds one Set lookup per node during position calculation.
