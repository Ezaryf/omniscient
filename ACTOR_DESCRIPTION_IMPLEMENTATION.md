# Actor Description Auto-Generation Implementation

## Summary
Implemented automatic description generation for simulation actors during campaign setup creation. Descriptions are generated using AI and saved to the agent nodes.

## Changes Made

### 1. Schema Updates (`lib/sim/types.ts`)
- Added `description: z.string().default("")` to `SetupActorSchema`
- Added `description: z.string().default("")` to `AgentSchema`
- Added new command type `updateAgent` for updating agent properties

### 2. AI Generation (`lib/server/ai/orchestrator.ts` & `lib/server/ai/prompts.ts`)
- Created `buildActorDescriptionPrompt()` function that generates character descriptions
- Modified `generateCampaignSetup()` to generate descriptions for each actor after the draft is created
- Descriptions are generated in parallel using `Promise.all()`
- Falls back to empty string if generation fails

### 3. Data Flow (`lib/sim/setup.ts`)
- Updated `materializeCampaignSetupDraft()` to pass `actor.description` when creating agents
- Updated `buildFallbackCampaignSetupDraft()` to include empty description fields

### 4. Command Handling (`lib/server/sim-controller.ts` & `lib/sim/campaign.ts`)
- Added `updateAgent` command handler in sim-controller
- Added metadata processing for `updateAgent` events in campaign.ts
- Agents can now be updated with name and description changes

### 5. UI Updates
- **Canvas Nodes** (`components/workspace/useCanvasNodes.ts`): Added `description` field to agent node data
- **Canvas Component** (`components/workspace/react-flow-world-canvas.tsx`): 
  - Added `onUpdateAgent` prop
  - Updated `handleUpdateNode` to call `onUpdateAgent` for agent nodes
- **Workspace Page** (`app/workspace/page.tsx`):
  - Added `onUpdateAgent` callback
  - Passes callback to ReactFlowWorldCanvas component

### 6. Demo Data (`lib/server/store.ts`)
- Added empty `description` fields to all demo agents

## How It Works

### During Simulation Creation:
1. User creates a new simulation with a name/description
2. AI generates the campaign setup draft (factions, actors, regions, etc.)
3. For each actor in the draft, AI generates a character description based on:
   - Actor name
   - Actor type (leader, diplomat, etc.)
   - Actor role
4. Descriptions are saved in the draft's actor objects
5. When the draft is applied, descriptions are transferred to the Agent entities

### During Node Editing:
1. User clicks on an agent node
2. Node editor panel appears showing name and description
3. User can click "Auto-generate" to create/update description
4. User can manually edit the description
5. Changes are saved via `updateAgent` command

## Testing Checklist

- [ ] Create a new simulation with AI enabled
- [ ] Verify actors have auto-generated descriptions
- [ ] Click on an actor node
- [ ] Verify description is displayed in the editor panel
- [ ] Click "Auto-generate" button
- [ ] Verify new description is generated and saved
- [ ] Manually edit description
- [ ] Verify changes are persisted
- [ ] Create simulation without AI key
- [ ] Verify actors have empty descriptions (fallback behavior)

## Known Issues

### Issue 1: Descriptions Not Showing After Creation
**Status**: Needs verification
**Possible causes**:
- Descriptions are generated but not immediately synced to UI
- Node editor panel not refreshing with new data
- Agent nodes vs CampaignNode confusion

### Issue 2: Unexpected Faction Nodes
**Status**: Needs investigation
**Description**: User sees disconnected faction campaign nodes (e.g., "ELON MUSK" faction node)
**Possible causes**:
- Campaign setup creating both faction entities and faction campaign nodes
- Test/demo data creating extra nodes
- UI showing nodes that should be hidden

## Next Steps

1. Test the complete flow with a real simulation
2. Verify descriptions are generated and displayed
3. Investigate the disconnected faction nodes issue
4. Consider adding description preview in the campaign setup sidecar
5. Add loading states for description generation
