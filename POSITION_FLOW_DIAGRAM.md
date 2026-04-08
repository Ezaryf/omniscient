# Canvas Position Management Flow

## Before Fix (Bug Present)

```
User Action: Drag Node in Move Mode
    ↓
stableNodePositionsRef.set(nodeId, {x: 250, y: 150})
suppressedStructuredLayoutIds.add(nodeId)
    ↓
User Action: Switch to Inspect Mode
    ↓
Mode changes, positions preserved ✅
    ↓
User Action: Click Cluster to Expand
    ↓
expandedClusterIds changes
    ↓
displayModel recalculates
    ↓
layoutExpandedMembers() runs
    ↓
Creates NEW structuredLayoutPositions Map
(Suppression prevents WRITING, but old positions still in Map)
    ↓
baseNodes recalculates via useCanvasNodes
    ↓
positionFor(nodeId) called:
  ├─ structuredLayoutPositions.has(nodeId)? YES
  ├─ return structuredLayoutPositions.get(nodeId) → {x: 0, y: 0} ❌
  └─ Never checks stableNodePositionsRef!
    ↓
Position sync effect:
  ├─ pending? NO
  ├─ stable? YES → {x: 250, y: 150}
  └─ base? {x: 0, y: 0} from positionFor ❌
    ↓
CONFLICT: stable says {x: 250, y: 150}, base says {x: 0, y: 0}
    ↓
Result: Node teleports to {x: 0, y: 0} ❌
```

## After Fix (Bug Resolved)

```
User Action: Drag Node in Move Mode
    ↓
stableNodePositionsRef.set(nodeId, {x: 250, y: 150})
suppressedStructuredLayoutIds.add(nodeId)
    ↓
User Action: Switch to Inspect Mode
    ↓
Mode changes, positions preserved ✅
    ↓
User Action: Click Cluster to Expand
    ↓
expandedClusterIds changes
    ↓
displayModel recalculates
    ↓
layoutExpandedMembers() runs
    ↓
Creates NEW structuredLayoutPositions Map
    ↓
baseNodes recalculates via useCanvasNodes
    ↓
positionFor(nodeId) called:
  ├─ suppressedStructuredLayoutIds.has(nodeId)? YES ✅
  ├─ return position (base) → {x: 0, y: 0} (ignored)
  └─ Skips structuredLayoutPositions check!
    ↓
Position sync effect:
  ├─ pending? NO
  ├─ stable? YES → {x: 250, y: 150} ✅
  └─ base? {x: 0, y: 0} (ignored because stable exists)
    ↓
Result: Node stays at {x: 250, y: 150} ✅
```

## Position Priority System

### During Active Drag
```
pendingNodePositionsRef (highest priority)
    ↓
Used for real-time position updates
```

### After Drag Complete
```
1. Check: suppressedStructuredLayoutIds.has(nodeId)?
   ├─ YES → Skip auto-layout, use stable cache
   └─ NO → Continue to auto-layout

2. Check: stableNodePositionsRef.has(nodeId)?
   ├─ YES → Use cached position ✅
   └─ NO → Continue to computed positions

3. Check: structuredLayoutPositions.has(nodeId)?
   ├─ YES → Use auto-layout position
   └─ NO → Continue to campaign layout

4. Check: campaignLayoutPositions.has(nodeId)?
   ├─ YES → Use campaign layout
   └─ NO → Use base position

5. Fallback: Use base entity position
```

## Key Components

### stableNodePositionsRef
- **Type**: `Map<string, {x: number, y: number}>`
- **Purpose**: Cache for manually positioned nodes
- **Lifetime**: Persists across mode switches and layout changes
- **Updated**: On drag stop, cleared on error

### suppressedStructuredLayoutIds
- **Type**: `Set<string>`
- **Purpose**: Marks nodes that should skip auto-layout
- **Lifetime**: Persists until page reload
- **Updated**: On drag stop for structured layout nodes

### suppressedCampaignLayoutIds
- **Type**: `Set<string>`
- **Purpose**: Marks campaign nodes that should skip campaign layout
- **Lifetime**: Persists until page reload
- **Updated**: On drag stop for campaign nodes

### pendingNodePositionsRef
- **Type**: `Record<string, {x: number, y: number}>`
- **Purpose**: Temporary storage during active drag
- **Lifetime**: Cleared after drag completes
- **Updated**: On drag start, during drag, cleared on drag stop

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Drags Node                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  onNodeDragStart                                            │
│  ├─ isDraggingNodeRef.current = true                       │
│  ├─ pendingNodePositionsRef[nodeId] = position             │
│  └─ notifyDraggingChange(true)                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  onNodeDrag (continuous)                                    │
│  └─ pendingNodePositionsRef[nodeId] = position             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  onNodeDragStop                                             │
│  ├─ stableNodePositionsRef.set(nodeId, position)           │
│  ├─ suppressedStructuredLayoutIds.add(nodeId)              │
│  ├─ suppressedCampaignLayoutIds.add(nodeId) [if campaign]  │
│  ├─ isDraggingNodeRef.current = false                      │
│  ├─ Persist to server                                      │
│  └─ delete pendingNodePositionsRef[nodeId]                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Position Sync Effect                                       │
│  ├─ Skip if isDraggingNodeRef.current === true             │
│  ├─ For each node:                                         │
│  │   ├─ pending? Use pending                               │
│  │   ├─ stable? Use stable ✅                              │
│  │   └─ else: Use base (from positionFor)                  │
│  └─ Update flowNodes                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Node Rendered at Stable Position ✅                        │
└─────────────────────────────────────────────────────────────┘
```

## Mode Switching Behavior

### Move Mode (M)
- Nodes are draggable
- Clicks are ignored (only drag works)
- Cursor: grab → grabbing → grab
- Visual: scale-105 on drag

### Inspect Mode (I)
- Nodes are NOT draggable
- Clicks select nodes
- Clusters can be expanded/collapsed
- Cursor: pointer
- Visual: hover effects only

### Connect Mode (C)
- First click: select source
- Second click: create connection
- Visual: source node glows

### Delete Mode (D)
- Click to delete node
- Visual: red highlight on hover

## Testing Strategy

### Unit Tests (Playwright)
1. Basic drag in Move mode
2. No drag in Inspect mode
3. Position preservation on mode switch
4. Cluster expansion without teleporting
5. Multiple cluster expansions
6. Complex mode switching cycles

### Integration Tests
1. Drag → Inspect → Expand (critical bug scenario)
2. Drag → Expand → Drag again
3. Multiple nodes dragged sequentially
4. Rapid mode switching

### Visual Tests
1. Scale animation during drag
2. Cursor changes
3. Glow effects
4. Connection hints

### Performance Tests
1. Drag with many nodes
2. Rapid interactions
3. Memory leak checks
