export type RelationType = "ally" | "foe" | "neutral";

export interface BattleNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface BattleEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface BattleAgent {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  aggression: number;
  courage: number;
  loyalty: number;
  fear: number;
  allies: Set<string>;
  foes: Set<string>;
  memory: BattleEvent[];
}

export type EventType =
  | "spawn"
  | "attack"
  | "defend"
  | "damage"
  | "death"
  | "turn_start"
  | "turn_end"
  | "no_action"
  | "alliance_break"
  | "conflict_emerge"
  | "story";

export interface BattleEvent {
  id: string;
  tick: number;
  type: EventType;
  actor?: string;
  target?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface BattleConfig {
  maxTicks?: number;
  defaultHealth?: number;
  attackDamageMin?: number;
  attackDamageMax?: number;
  defendReduction?: number;
  allyGuardChance?: number;
  seed?: number;
  storyMode?: boolean;
  dynamicConflict?: boolean;
  dynamicConflictProbability?: number;
  narrativeStyle?: "cinematic" | "military";
  llmEnhance?: boolean;
  llmProvider?: "openai" | "anthropic" | "gemini" | "ollama";
  llmApiKey?: string;
  llmModel?: string;
}

export interface BattleSnapshot {
  tick: number;
  agents: Record<string, Omit<BattleAgent, "allies" | "foes" | "memory"> & {
    allies: string[];
    foes: string[];
    memory: BattleEvent[];
  }>;
  recentEvents: BattleEvent[];
  finished: boolean;
  winner: string | null;
}

export interface StoryGenerator {
  generate(events: BattleEvent[], snapshot: BattleSnapshot): string;
}

export interface DynamicConflictConfig {
  enabled: boolean;
  probability: number;
  maxConflicts: number;
}
