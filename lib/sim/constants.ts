import type { RuleSet } from "./types";

/** Milliseconds between ticks when simulation is playing */
export const TICK_INTERVAL_MS = 1000;

/** How many ticks between automatic snapshots */
export const SNAPSHOT_FREQUENCY = 10;

/** Default simulation rules */
export const DEFAULT_RULES: RuleSet = {
  scarcity: 0.3,
  trustDecay: 0.02,
  contagion: 0.4,
  shockLikelihood: 0.05,
  maxTicks: 500,
  aiConfidenceFloor: 0.6,
  scenarioIntensity: 0.5,
};

/** Default seed for deterministic randomness */
export const DEFAULT_SEED = 42;

/** Maximum agents per scenario */
export const MAX_AGENTS = 50;

/** Maximum branches per project */
export const MAX_BRANCHES = 20;

/** LRU cache size for AI responses */
export const AI_CACHE_SIZE = 256;

/** Maximum event log entries to return per page */
export const EVENT_PAGE_SIZE = 50;
