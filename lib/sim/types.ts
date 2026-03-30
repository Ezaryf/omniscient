import { z } from "zod";

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

export const AgentIntentSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "attack",
    "defend",
    "negotiate",
    "ally",
    "trade",
    "gather",
    "explore",
    "recover",
    "stabilize",
    "retaliate",
  ]),
  targetIds: z.array(z.string()).default([]),
  status: z.enum(["active", "blocked", "abandoned", "resolved"]).default("active"),
  priority: z.number().min(0).max(1),
  createdTick: z.number().int().min(0),
  lastEvaluatedTick: z.number().int().min(0),
  commitment: z.number().min(0).max(1).default(0.5),
  rationale: z.string(),
  sourceEventId: z.string().nullable().default(null),
});
export type AgentIntent = z.infer<typeof AgentIntentSchema>;

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
  activeIntent: AgentIntentSchema.nullable().default(null),
  intentHistory: z.array(AgentIntentSchema).default([]),
  position: PositionSchema,
  status: z.enum(["alive", "dead", "inactive", "exiled"]),
});
export type Agent = z.infer<typeof AgentSchema>;

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

export const CampaignNodeKindSchema = z.enum([
  "agent",
  "faction",
  "front",
  "event",
  "place",
  "region",
  "route",
  "site",
  "party",
]);
export type CampaignNodeKind = z.infer<typeof CampaignNodeKindSchema>;

export const CampaignNodeSchema = z.object({
  id: z.string(),
  kind: CampaignNodeKindSchema,
  name: z.string(),
  factionId: z.string().nullable().default(null),
  regionId: z.string().nullable().default(null),
  siteId: z.string().nullable().default(null),
  position: PositionSchema,
  status: z.string().default("active"),
  tags: z.array(z.string()).default([]),
  metrics: z.record(z.string(), z.number()).default({}),
});
export type CampaignNode = z.infer<typeof CampaignNodeSchema>;

export const BoardSelectionTypeSchema = z.enum([
  "agent",
  "campaignNode",
  "region",
  "site",
  "route",
  "front",
  "boardLink",
]);
export type BoardSelectionType = z.infer<typeof BoardSelectionTypeSchema>;

export const BoardSelectionSchema = z.object({
  type: BoardSelectionTypeSchema,
  id: z.string(),
});
export type BoardSelection = z.infer<typeof BoardSelectionSchema>;

export const RegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["homeland", "frontier", "wilds", "city-state", "sea"]),
  center: PositionSchema,
  radius: z.number().positive().default(120),
  controllingFactionId: z.string().nullable().default(null),
  supply: z.number().min(0).max(1).default(0.5),
  stability: z.number().min(0).max(1).default(0.5),
  threat: z.number().min(0).max(1).default(0.2),
  visibility: z.enum(["visible", "fogged", "hidden"]).default("visible"),
  tags: z.array(z.string()).default([]),
});
export type Region = z.infer<typeof RegionSchema>;

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["capital", "stronghold", "market", "ruin", "waypoint", "sanctum"]),
  regionId: z.string(),
  position: PositionSchema,
  controllingFactionId: z.string().nullable().default(null),
  status: z.enum(["stable", "threatened", "sieged", "ruined"]).default("stable"),
  tags: z.array(z.string()).default([]),
});
export type Site = z.infer<typeof SiteSchema>;

export const RouteStatusSchema = z.enum(["open", "strained", "disrupted", "collapsed"]);
export type RouteStatus = z.infer<typeof RouteStatusSchema>;

export const RouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  fromSiteId: z.string(),
  toSiteId: z.string(),
  controllingFactionId: z.string().nullable().default(null),
  status: RouteStatusSchema.default("open"),
  risk: z.number().min(0).max(1).default(0.2),
  integrity: z.number().min(0).max(1).default(1),
  traffic: z.number().min(0).max(1).default(0.5),
  tags: z.array(z.string()).default([]),
});
export type Route = z.infer<typeof RouteSchema>;

export const MapTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["party", "faction", "threat"]),
  factionId: z.string().nullable().default(null),
  regionId: z.string().nullable().default(null),
  siteId: z.string().nullable().default(null),
  position: PositionSchema,
  visible: z.boolean().default(true),
  status: z.enum(["ready", "moving", "contested", "hidden"]).default("ready"),
});
export type MapToken = z.infer<typeof MapTokenSchema>;

export const MapLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  regions: z.array(RegionSchema).default([]),
  sites: z.array(SiteSchema).default([]),
  routes: z.array(RouteSchema).default([]),
  tokens: z.array(MapTokenSchema).default([]),
});
export type MapLayer = z.infer<typeof MapLayerSchema>;

export const FrontClockSchema = z.object({
  id: z.string(),
  name: z.string(),
  regionId: z.string().nullable().default(null),
  factionId: z.string().nullable().default(null),
  opposingFactionId: z.string().nullable().default(null),
  pressure: z.number().min(0).max(1).default(0),
  progress: z.number().min(0).max(1).default(0),
  status: z.enum(["quiet", "rising", "critical", "resolved"]).default("quiet"),
  stakes: z.string().default("Control of the frontier"),
  lastAdvancedTick: z.number().int().min(0).default(0),
});
export type FrontClock = z.infer<typeof FrontClockSchema>;

export const ProjectionArtifactSchema = z.object({
  id: z.string(),
  tick: z.number().int().min(0),
  type: z.enum(["warning", "opportunity", "prediction", "prep"]),
  subjectType: z.enum(["front", "region", "route", "faction", "party", "event"]),
  subjectId: z.string(),
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string()).default([]),
  severity: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  acknowledged: z.boolean().default(false),
});
export type ProjectionArtifact = z.infer<typeof ProjectionArtifactSchema>;

export const CanvasBindingEntityTypeSchema = z.enum([
  "agent",
  "faction",
  "region",
  "site",
  "front",
  "event",
]);
export type CanvasBindingEntityType = z.infer<typeof CanvasBindingEntityTypeSchema>;

export const CanvasBindingSchema = z.object({
  id: z.string(),
  shapeId: z.string(),
  entityType: CanvasBindingEntityTypeSchema,
  entityId: z.string(),
});
export type CanvasBinding = z.infer<typeof CanvasBindingSchema>;

export const BoardLinkTypeSchema = z.enum([
  "causal",
  "alliance",
  "conflict",
  "dependency",
  "route",
]);
export type BoardLinkType = z.infer<typeof BoardLinkTypeSchema>;

export const BoardLinkEndpointSchema = z.object({
  type: z.enum(["agent", "campaignNode", "region", "site", "front"]),
  id: z.string(),
});
export type BoardLinkEndpoint = z.infer<typeof BoardLinkEndpointSchema>;

export const BoardLinkSchema = z.object({
  id: z.string(),
  type: BoardLinkTypeSchema,
  source: BoardLinkEndpointSchema,
  target: BoardLinkEndpointSchema,
  label: z.string().nullable().default(null),
  createdAtTick: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});
export type BoardLink = z.infer<typeof BoardLinkSchema>;

export const CanvasDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  snapshot: z.unknown().nullable().default(null),
  bindings: z.array(CanvasBindingSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>;

export const GmNoteSchema = z.object({
  id: z.string(),
  tick: z.number().int().min(0),
  title: z.string(),
  content: z.string(),
  linkedEventId: z.string().nullable().default(null),
  linkedRegionId: z.string().nullable().default(null),
  linkedSiteId: z.string().nullable().default(null),
  linkedFrontId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  status: z.enum(["open", "acknowledged", "resolved"]).default("open"),
});
export type GmNote = z.infer<typeof GmNoteSchema>;

export const EventImpactSchema = z.object({
  targetId: z.string(),
  targetKind: z
    .enum(["agent", "faction", "region", "route", "site", "front", "token", "projection"])
    .default("agent"),
  field: z.string(),
  delta: z.number(),
});
export type EventImpact = z.infer<typeof EventImpactSchema>;

export const CausalEventTypeSchema = z.enum([
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
  "movement",
  "front_advance",
  "travel",
  "supply",
  "collapse",
]);
export type CausalEventType = z.infer<typeof CausalEventTypeSchema>;

export const CausalLinkTypeSchema = z.enum([
  "trigger",
  "amplify",
  "redirect",
  "resolve",
]);
export type CausalLinkType = z.infer<typeof CausalLinkTypeSchema>;

export const CausalEventSchema = z.object({
  id: z.string(),
  tick: z.number().int().min(0),
  type: CausalEventTypeSchema,
  sourceAgentId: z.string().nullable(),
  targetAgentId: z.string().nullable(),
  actorIds: z.array(z.string()).default([]),
  targetIds: z.array(z.string()).default([]),
  description: z.string(),
  impact: z.array(EventImpactSchema).default([]),
  parentEventIds: z.array(z.string()).default([]),
  causeChain: z.array(z.string()).default([]),
  causedBy: z.array(z.string()).default([]),
  causalDepth: z.number().int().min(0).default(0),
  causalType: CausalLinkTypeSchema.nullable().default(null),
  affects: z.array(z.string()).default([]),
  invalidates: z.array(z.string()).default([]),
  branchOriginEventId: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.7),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CausalEvent = z.infer<typeof CausalEventSchema>;

export const SimEventSchema = CausalEventSchema;
export type SimEvent = CausalEvent;

export const CausalityGraphSchema = z.object({
  parentIdsByEventId: z.record(z.string(), z.array(z.string())).default({}),
  childIdsByEventId: z.record(z.string(), z.array(z.string())).default({}),
  depthByEventId: z.record(z.string(), z.number()).default({}),
});
export type CausalityGraph = z.infer<typeof CausalityGraphSchema>;

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

export const ModifierSchema = z.object({
  id: z.string(),
  type: z.enum(["global", "faction"]),
  targetId: z.string().nullable(),
  field: z.string(),
  multiplier: z.number().default(1),
  offset: z.number().default(0),
  description: z.string(),
  remainingTicks: z.number().int(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

export const WorldStateSchema = z.object({
  tick: z.number().int().min(0),
  agents: z.array(AgentSchema),
  relationships: z.array(RelationshipEdgeSchema),
  campaignNodes: z.array(CampaignNodeSchema).default([]),
  boardLinks: z.array(BoardLinkSchema).default([]),
  map: MapLayerSchema.default({
    id: "map-main",
    name: "Campaign Map",
    regions: [],
    sites: [],
    routes: [],
    tokens: [],
  }),
  fronts: z.array(FrontClockSchema).default([]),
  projections: z.array(ProjectionArtifactSchema).default([]),
  gmNotes: z.array(GmNoteSchema).default([]),
  events: z.array(CausalEventSchema).default([]),
  causalityGraph: CausalityGraphSchema.default({
    parentIdsByEventId: {},
    childIdsByEventId: {},
    depthByEventId: {},
  }),
  activeModifiers: z.array(ModifierSchema).default([]),
  rules: RuleSetSchema,
  seed: z.number().int(),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

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

export const TimelineBranchSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  scenarioId: z.string(),
  parentBranchId: z.string().nullable(),
  name: z.string(),
  summary: z.string(),
  branchPointTick: z.number().int().min(0),
  branchOriginEventId: z.string().nullable().default(null),
  currentTick: z.number().int().min(0),
  stateHash: z.string(),
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  latestState: WorldStateSchema,
});
export type TimelineBranch = z.infer<typeof TimelineBranchSchema>;

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

export const AiSettingsSchema = z
  .object({
    provider: z.enum(["openai", "gemini", "anthropic", "groq", "ollama"]),
    apiKey: z.string(),
    model: z.string(),
  })
  .optional();

export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const SetupFactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  identity: z.string(),
  goal: z.string(),
  temperament: z.enum(["diplomatic", "volatile", "pragmatic", "zealous", "cunning"]),
});
export type SetupFaction = z.infer<typeof SetupFactionSchema>;

export const SetupActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  factionId: z.string(),
  role: z.string(),
  goal: z.string(),
});
export type SetupActor = z.infer<typeof SetupActorSchema>;

export const SetupRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["homeland", "frontier", "wilds", "city-state", "sea"]),
  controllingFactionId: z.string().nullable().default(null),
  summary: z.string(),
});
export type SetupRegion = z.infer<typeof SetupRegionSchema>;

export const SetupRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  fromRegionId: z.string(),
  toRegionId: z.string(),
  controllingFactionId: z.string().nullable().default(null),
  risk: z.number().min(0).max(1).default(0.25),
  summary: z.string(),
});
export type SetupRoute = z.infer<typeof SetupRouteSchema>;

export const SetupFrontSchema = z.object({
  id: z.string(),
  name: z.string(),
  regionId: z.string(),
  factionId: z.string().nullable().default(null),
  opposingFactionId: z.string().nullable().default(null),
  stakes: z.string(),
  pressure: z.number().min(0).max(1).default(0.45),
  progress: z.number().min(0).max(1).default(0.3),
});
export type SetupFront = z.infer<typeof SetupFrontSchema>;

export const SetupEventSchema = z.object({
  type: CausalEventTypeSchema.default("injected"),
  description: z.string(),
  regionId: z.string().nullable().default(null),
  frontId: z.string().nullable().default(null),
  routeIds: z.array(z.string()).default([]),
  stakes: z.string(),
});
export type SetupEvent = z.infer<typeof SetupEventSchema>;

export const CampaignSetupDraftSchema = z.object({
  title: z.string(),
  premise: z.string(),
  factions: z.array(SetupFactionSchema).min(2).max(4),
  actors: z.array(SetupActorSchema).min(2).max(6),
  regions: z.array(SetupRegionSchema).min(2).max(4),
  routes: z.array(SetupRouteSchema).min(1).max(6),
  fronts: z.array(SetupFrontSchema).min(1).max(3),
  incitingEvent: SetupEventSchema,
  generatedBy: z.enum(["ai", "fallback"]),
});
export type CampaignSetupDraft = z.infer<typeof CampaignSetupDraftSchema>;

const InjectedEventInputSchema = CausalEventSchema.omit({
  id: true,
  tick: true,
  actorIds: true,
  targetIds: true,
  causeChain: true,
  causedBy: true,
  affects: true,
  invalidates: true,
  branchOriginEventId: true,
  confidence: true,
}).extend({
  sourceAgentId: z.string().nullable().optional(),
  targetAgentId: z.string().nullable().optional(),
  impact: z.array(EventImpactSchema).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
    type: z.literal("simulateUntil"),
    branchId: z.string(),
    targetTick: z.number().int().min(0),
    currentTick: z.number().int().min(0).optional(),
    aiSettings: AiSettingsSchema,
  }),
  z.object({
    type: z.literal("injectEvent"),
    branchId: z.string(),
    event: InjectedEventInputSchema,
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("changeRule"),
    branchId: z.string(),
    patch: RuleSetSchema.partial(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createBranch"),
    branchId: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("forkFromEvent"),
    branchId: z.string(),
    eventId: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("acknowledgeConsequence"),
    branchId: z.string(),
    consequenceId: z.string(),
    note: z.string().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("moveToken"),
    branchId: z.string(),
    tokenId: z.string(),
    regionId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("moveAgent"),
    branchId: z.string(),
    agentId: z.string(),
    x: z.number(),
    y: z.number(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("moveSite"),
    branchId: z.string(),
    siteId: z.string(),
    regionId: z.string().nullable().optional(),
    x: z.number(),
    y: z.number(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("moveRegion"),
    branchId: z.string(),
    regionId: z.string(),
    x: z.number(),
    y: z.number(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("resizeRegion"),
    branchId: z.string(),
    regionId: z.string(),
    radius: z.number().positive(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("moveCampaignNode"),
    branchId: z.string(),
    nodeId: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    radius: z.number().positive().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createRegion"),
    branchId: z.string(),
    name: z.string(),
    kind: RegionSchema.shape.kind,
    x: z.number(),
    y: z.number(),
    radius: z.number().positive().optional(),
    controllingFactionId: z.string().nullable().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createSite"),
    branchId: z.string(),
    name: z.string(),
    kind: SiteSchema.shape.kind,
    x: z.number(),
    y: z.number(),
    regionId: z.string().nullable().optional(),
    controllingFactionId: z.string().nullable().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createToken"),
    branchId: z.string(),
    name: z.string(),
    kind: MapTokenSchema.shape.kind,
    x: z.number(),
    y: z.number(),
    regionId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    factionId: z.string().nullable().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createRoute"),
    branchId: z.string(),
    name: z.string(),
    fromSiteId: z.string(),
    toSiteId: z.string(),
    controllingFactionId: z.string().nullable().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createBoardLink"),
    branchId: z.string(),
    linkType: BoardLinkTypeSchema,
    source: BoardLinkEndpointSchema,
    target: BoardLinkEndpointSchema,
    label: z.string().nullable().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("createCampaignNode"),
    branchId: z.string(),
    name: z.string(),
    kind: z.enum(["agent", "faction", "front", "event", "place"]),
    x: z.number(),
    y: z.number(),
    factionId: z.string().nullable().optional(),
    regionId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("deleteCampaignNode"),
    branchId: z.string(),
    nodeId: z.string(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("deleteBoardLink"),
    branchId: z.string(),
    linkId: z.string(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("advanceFront"),
    branchId: z.string(),
    frontId: z.string(),
    delta: z.number(),
    rationale: z.string().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("applySetup"),
    branchId: z.string(),
    draft: CampaignSetupDraftSchema,
    currentTick: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("generateNarrative"),
    branchId: z.string(),
    aiSettings: z.any().optional(),
    currentTick: z.number().int().min(0).optional(),
  }),
]);
export type SimCommand = z.infer<typeof SimCommandSchema>;

export const TickResultSchema = z.object({
  worldState: WorldStateSchema,
  events: z.array(CausalEventSchema),
  proposals: z.array(ActionProposalSchema),
  snapshotCreated: z.boolean(),
});
export type TickResult = z.infer<typeof TickResultSchema>;
