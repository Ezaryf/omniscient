import type { BattleAgent, BattleEvent } from "./types";

export interface CombatRules {
  baseDamage: number;
  damageVariance: number;
  criticalHitChance: number;
  criticalHitMultiplier: number;
  minDamage: number;
  allyDefenseEnabled: boolean;
  allyDefenseChance: number;
  allyDefenseDamageReduction: number;
}

export const DEFAULT_COMBAT_RULES: CombatRules = {
  baseDamage: 20,
  damageVariance: 0.3,
  criticalHitChance: 0.1,
  criticalHitMultiplier: 2,
  minDamage: 1,
  allyDefenseEnabled: true,
  allyDefenseChance: 0.6,
  allyDefenseDamageReduction: 0.5,
};

export interface BehaviorRules {
  aggressionWeight: number;
  fearWeight: number;
  loyaltyWeight: number;
  courageWeight: number;
  actionThreshold: number;
}

export const DEFAULT_BEHAVIOR_RULES: BehaviorRules = {
  aggressionWeight: 1.0,
  fearWeight: 0.5,
  loyaltyWeight: 0.8,
  courageWeight: 0.6,
  actionThreshold: 0.5,
};

export interface EmotionalRules {
  fearOnAllyDeath: number;
  loyaltyOnAllyDeath: number;
  aggressionOnAttack: number;
  fearOnDamage: number;
  fearThresholdForDefection: number;
}

export const DEFAULT_EMOTIONAL_RULES: EmotionalRules = {
  fearOnAllyDeath: 0.08,
  loyaltyOnAllyDeath: 0.03,
  aggressionOnAttack: 0.02,
  fearOnDamage: 0.05,
  fearThresholdForDefection: 0.85,
};

export function calculateActionProbability(
  agent: BattleAgent,
  rules: BehaviorRules
): number {
  const aggressionFactor = agent.aggression * rules.aggressionWeight;
  const fearFactor = (1 - agent.fear) * rules.fearWeight;
  const courageFactor = agent.courage * rules.courageWeight;

  return Math.min(1, Math.max(0, aggressionFactor + fearFactor + courageFactor));
}

export function calculateDamage(
  attacker: BattleAgent,
  defender: BattleAgent,
  rules: CombatRules,
  rng: { next: () => number }
): number {
  const variance = 1 + (rng.next() * 2 - 1) * rules.damageVariance;
  let damage = rules.baseDamage * variance;

  if (rng.next() < rules.criticalHitChance) {
    damage *= rules.criticalHitMultiplier;
  }

  return Math.max(rules.minDamage, Math.floor(damage));
}

export function calculateGuardProbability(
  defender: BattleAgent,
  rules: CombatRules,
  rng: { next: () => number }
): boolean {
  const loyaltyFactor = defender.loyalty * rules.allyDefenseChance;
  const courageFactor = defender.courage * 0.5;
  const fearFactor = 1 - defender.fear * 0.3;

  const probability = loyaltyFactor * courageFactor * fearFactor;
  return rng.next() < probability;
}

export function applyEmotionalDrift(
  agent: BattleAgent,
  event: BattleEvent,
  rules: EmotionalRules
): void {
  if (event.type === "attack") {
    agent.aggression = Math.min(1, agent.aggression + rules.aggressionOnAttack);
    agent.fear = Math.max(0, agent.fear - 0.01);
  }

  if (event.type === "damage" && event.target === agent.id) {
    agent.fear = Math.min(1, agent.fear + rules.fearOnDamage);
  }

  if (event.type === "death" && agent.allies.has(event.target ?? "")) {
    agent.fear = Math.min(1, agent.fear + rules.fearOnAllyDeath);
    agent.loyalty = Math.max(0, agent.loyalty - rules.loyaltyOnAllyDeath);
  }
}

export function shouldBreakAlliance(agent: BattleAgent, rules: EmotionalRules): boolean {
  return agent.fear > rules.fearThresholdForDefection;
}

export function calculateDynamicConflictProbability(
  agentA: BattleAgent,
  agentB: BattleAgent,
  baseProbability: number
): number {
  const aggressionFactor = (agentA.aggression + agentB.aggression) / 2;
  const loyaltyDiff = Math.abs(agentA.loyalty - agentB.loyalty);
  
  return baseProbability * (aggressionFactor + loyaltyDiff);
}
