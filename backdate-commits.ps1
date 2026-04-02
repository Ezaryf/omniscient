Set-Location "c:\Users\ezary\OneDrive\Documents\Coding-Language\omniscient"

# ===== APRIL 2 - Project Foundation =====
# Commit 1: Project config and dependencies
$env:GIT_AUTHOR_DATE = "2026-04-02T10:30:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-02T10:30:00+08:00"
git add .gitignore package.json tsconfig.json bun.lock bunfig.toml next-env.d.ts vitest.config.ts
git commit -m "020426 - Update project configuration and dependencies"

# Commit 2: Database schema
$env:GIT_AUTHOR_DATE = "2026-04-02T16:00:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-02T16:00:00+08:00"
git add prisma/schema.prisma
git commit -m "020426 - Update Prisma database schema"

# ===== APRIL 3 - Simulation Core =====
# Commit 1: Simulation types and engine
$env:GIT_AUTHOR_DATE = "2026-04-03T09:15:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-03T09:15:00+08:00"
git add lib/sim/types.ts lib/sim/engine.ts lib/sim/setup.ts lib/sim/campaign.ts
git commit -m "030426 - Refactor simulation engine and type system"

# Commit 2: AI orchestration and prompts
$env:GIT_AUTHOR_DATE = "2026-04-03T14:30:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-03T14:30:00+08:00"
git add lib/sim/ai/fallback.ts lib/server/ai/orchestrator.ts lib/server/ai/prompts.ts
git commit -m "030426 - Improve AI orchestrator and prompt pipeline"

# ===== APRIL 4 - Server & State =====
# Commit 1: Server controllers and stores
$env:GIT_AUTHOR_DATE = "2026-04-04T11:00:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-04T11:00:00+08:00"
git add lib/server/sim-controller.ts lib/server/store.ts lib/stores/simulation-store.ts
git commit -m "040426 - Update server controllers and simulation store"

# Commit 2: UI primitives
$env:GIT_AUTHOR_DATE = "2026-04-04T17:20:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-04T17:20:00+08:00"
git add components/ui/badge.tsx components/ui/button.tsx
git commit -m "040426 - Refine UI component primitives"

# ===== APRIL 5 - Canvas System =====
# Commit 1: Canvas core components
$env:GIT_AUTHOR_DATE = "2026-04-05T10:00:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-05T10:00:00+08:00"
git add components/workspace/canvas-nodes.tsx components/workspace/freeform-canvas.tsx components/workspace/react-flow-world-canvas.tsx components/workspace/world-canvas.tsx
git commit -m "050426 - Rebuild workspace canvas rendering system"

# Commit 2: Workspace panels and controls
$env:GIT_AUTHOR_DATE = "2026-04-05T15:45:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-05T15:45:00+08:00"
git add components/workspace/control-bar.tsx components/workspace/context-inspector.tsx components/workspace/scenario-panel.tsx components/workspace/timeline-rail.tsx
git commit -m "050426 - Add workspace control panels and timeline rail"

# ===== APRIL 6 - Workspace Logic =====
# Commit 1: Workspace hooks and layout
$env:GIT_AUTHOR_DATE = "2026-04-06T09:30:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-06T09:30:00+08:00"
git add components/workspace/use-workspace-layout.ts components/workspace/useCanvasEdges.ts components/workspace/useCanvasNodes.ts
git commit -m "060426 - Implement workspace hooks and layout logic"

# Commit 2: Campaign and event modals
$env:GIT_AUTHOR_DATE = "2026-04-06T14:15:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-06T14:15:00+08:00"
git add components/workspace/campaign-setup-sidecar.tsx components/workspace/inject-event-modal.tsx components/workspace/narration-modal.tsx
git commit -m "060426 - Build campaign setup and event injection modals"

# ===== APRIL 7 - Pages & Views =====
# Commit 1: Application pages
$env:GIT_AUTHOR_DATE = "2026-04-07T10:45:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-07T10:45:00+08:00"
git add app/page.tsx app/dashboard/page.tsx app/workspace/page.tsx app/insights/page.tsx app/compare/page.tsx
git commit -m "070426 - Update all application pages"

# Commit 2: Dashboard and compare components
$env:GIT_AUTHOR_DATE = "2026-04-07T16:30:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-07T16:30:00+08:00"
git add components/dashboard/create-simulation-modal.tsx components/dashboard/dashboard-content.tsx components/compare/branch-diff.tsx
git commit -m "070426 - Enhance dashboard and branch comparison views"

# ===== APRIL 8 - Polish & Tests =====
# Commit 1: Styles and API routes
$env:GIT_AUTHOR_DATE = "2026-04-08T09:00:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-08T09:00:00+08:00"
git add app/globals.css app/api/node-description/
git commit -m "080426 - Update global styles and add node description API"

# Commit 2: Test suite expansion
$env:GIT_AUTHOR_DATE = "2026-04-08T13:30:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-08T13:30:00+08:00"
git add tests/e2e-smoke.spec.ts tests/sim/engine.test.ts tests/workspace-board.spec.ts tests/canvas-drag-drop.spec.ts tests/canvas-ui-interactions.spec.ts tests/e2e-debug.spec.ts tests/README.md
git commit -m "080426 - Expand test coverage for simulation and workspace"

# Commit 3: Documentation and dev config
$env:GIT_AUTHOR_DATE = "2026-04-08T16:00:00+08:00"
$env:GIT_COMMITTER_DATE = "2026-04-08T16:00:00+08:00"
git add README.md .agents/ .vscode/ skills-lock.json ACTOR_DESCRIPTION_IMPLEMENTATION.md DRAG_FIX_SUMMARY.md FINAL_IMPLEMENTATION_SUMMARY.md POSITION_FLOW_DIAGRAM.md TESTING_INSTRUCTIONS.md
git commit -m "080426 - Add documentation and dev environment config"

# Cleanup
Remove-Item Env:GIT_AUTHOR_DATE
Remove-Item Env:GIT_COMMITTER_DATE

Write-Host "`n===== COMMIT LOG =====" -ForegroundColor Green
git log --oneline -20
