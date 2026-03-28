import { z } from "zod";

// ─── Agent & State ───────────────────────────────────────────────

export const GoalSchema = z.object({
  id: z.string(),
  label: z.string(),
  priority: z.number().min(0).max(1),
  progress: z.number().min(0).max(1),
  status: z.enum(["active", "completed", "failed", "blocked"]),
});
export type Goal = z.infer<typeof GoalSchema>;

export const AgentTraitsSchema = z.object({
  aggression: z.number().min(0).max(1),
  diplomacy: z.number().min(0).max(1),
  resourcefulness: z.number().min(0).max(1),
  loyalty: z.number().min(0).max(1),
  adaptability: z.number().min(0).max(1),
});
export type AgentTraits = z.infer<typeof AgentTraitsSchema>;

export const AgentMemoryEntrySchema = z.object({
  tick: z.number(),
  type: z.string(),
  description: z.string(),
  significance: z.number().min(0).max(1),
});
export type AgentMemoryEntry = z.infer<typeof AgentMemoryEntrySchema>;

export const AgentStateSchema = z.object({
  health: z.number().min(0).max(1),
  morale: z.number().min(0).max(1),
  influence: z.number().min(0),
  wealth: z.number().min(0),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  factionId: z.string(),
  goals: z.array(GoalSchema),
  traits: AgentTraitsSchema,
  state: AgentStateSchema,
  resources: z.record(z.string(), z.number()),
  memory: z.array(AgentMemoryEntrySchema),
  position: PositionSchema,
  status: z.enum(["alive", "dead", "inactive", "exiled"]),
});
export type Agent = z.infer<typeof AgentSchema>;

// ─── Relationships ───────────────────────────────────────────────

export const RelationshipEdgeSchema = z.object({
  id: z.string(),
  sourceAgentId: z.string(),
  targetAgentId: z.string(),
  trust: z.number().min(-1).max(1),
  influence: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  lastUpdatedTick: z.number(),
});
export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;

// ─── Events ──────────────────────────────────────────────────────

export const EventImpactSchema = z.object({
  targetId: z.string(),
  field: z.string(),
  delta: z.number(),
});
export type EventImpact = z.infer<typeof EventImpactSchema>;

export const SimEventSchema = z.object({
  id: z.string(),
  tick: z.number(),
  type: z.enum([
    "action",
    "reaction",
    "negotiation",
    "conflict",
    "trade",
    "alliance",
    "betrayal",
    "natural_event",
    "injected",
    "rule_change",
  ]),
  sourceAgentId: z.string().nullable(),
  targetAgentId: z.string().nullable(),
  description: z.string(),
  impact: z.array(EventImpactSchema),
  causeChain: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
});
export type SimEvent = z.infer<typeof SimEventSchema>;

export const RuleSetSchema = z.object({
  scarcity: z.number().min(0).max(1),
  trustDecay: z.number().min(0).max(0.1),
  contagion: z.number().min(0).max(1),
  shockLikelihood: z.number().min(0).max(1),
  maxTicks: z.number().int().positive(),
  aiConfidenceFloor: z.number().min(0).max(1),
  scenarioIntensity: z.number().min(0).max(1).default(0.5),
});
export type RuleSet = z.infer<typeof RuleSetSchema>;

// ─── Tactical Modifiers ──────────────────────────────────────────

export const ModifierSchema = z.object({
  id: z.string(),
  type: z.enum(["global", "faction"]),
  targetId: z.string().nullable(),
  field: z.string(), // e.g. "wealth_gen", "health_decay", "trust_shift"
  multiplier: z.number().default(1),
  offset: z.number().default(0),
  description: z.string(),
  remainingTicks: z.number().int(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

// ─── World State ─────────────────────────────────────────────────

export const WorldStateSchema = z.object({
  tick: z.number().int().min(0),
  agents: z.array(AgentSchema),
  relationships: z.array(RelationshipEdgeSchema),
  events: z.array(SimEventSchema),
  activeModifiers: z.array(ModifierSchema).default([]),
  rules: RuleSetSchema,
  seed: z.number().int(),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

// ─── Snapshots ───────────────────────────────────────────────────

export const SnapshotSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  tick: z.number().int().min(0),
  kind: z.enum(["branch_point", "checkpoint", "manual"]),
  stateHash: z.string(),
  state: WorldStateSchema,
  createdAt: z.string().datetime(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

// ─── Branches ────────────────────────────────────────────────────

export const TimelineBranchSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  scenarioId: z.string(),
  parentBranchId: z.string().nullable(),
  name: z.string(),
  summary: z.string(),
  branchPointTick: z.number().int().min(0),
  currentTick: z.number().int().min(0),
  stateHash: z.string(),
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  latestState: WorldStateSchema,
});
export type TimelineBranch = z.infer<typeof TimelineBranchSchema>;

// ─── AI Proposals ────────────────────────────────────────────────

export const ActionProposalSchema = z.object({
  agentId: z.string(),
  actionType: z.enum([
    "negotiate",
    "attack",
    "defend",
    "trade",
    "ally",
    "betray",
    "retreat",
    "gather",
    "explore",
    "rest",
  ]),
  targetAgentId: z.string().nullable(),
  rationale: z.string().max(500),
  confidence: z.number().min(0).max(1),
  predictedImpacts: z.array(EventImpactSchema).optional(),
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

export const ExplanationArtifactSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  tick: z.number(),
  scope: z.enum(["agent", "event", "branch", "global"]),
  subjectId: z.string(),
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  generatedBy: z.enum(["ai", "heuristic"]),
});
export type ExplanationArtifact = z.infer<typeof ExplanationArtifactSchema>;

// ─── AI Settings (passed from client) ────────────────────────────

export const AiSettingsSchema = z.object({
  provider: z.enum(["openai", "gemini", "anthropic", "groq", "ollama"]),
  apiKey: z.string(),
  model: z.string(),
}).optional();

export type AiSettings = z.infer<typeof AiSettingsSchema>;

// ─── Simulation Commands ─────────────────────────────────────────

export const SimCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play"), branchId: z.string() }),
  z.object({ type: z.literal("pause"), branchId: z.string() }),
  z.object({
    type: z.literal("step"),
    branchId: z.string(),
    currentTick: z.number().int().min(0).optional(),
    aiSettings: AiSettingsSchema,
  }),
  z.object({
    type: z.literal("fastForward"),
    branchId: z.string(),
    ticks: z.number().int().positive(),
    currentTick: z.number().int().min(0).optional(),
    aiSettings: AiSettingsSchema,
  }),
  z.object({
    type: z.literal("injectEvent"),
    branchId: z.string(),
    event: SimEventSchema.omit({ id: true, tick: true }),
    currentTick: z.number().int().min(0).optional()
  }),
  z.object({
    type: z.literal("changeRule"),
    branchId: z.string(),
    patch: RuleSetSchema.partial(),
    currentTick: z.number().int().min(0).optional()
  }),
  z.object({
    type: z.literal("createBranch"),
    branchId: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    currentTick: z.number().int().min(0).optional()
  }),
]);
export type SimCommand = z.infer<typeof SimCommandSchema>;

// ─── Tick Result ─────────────────────────────────────────────────

export const TickResultSchema = z.object({
  worldState: WorldStateSchema,
  events: z.array(SimEventSchema),
  proposals: z.array(ActionProposalSchema),
  snapshotCreated: z.boolean(),
});
export type TickResult = z.infer<typeof TickResultSchema>;
