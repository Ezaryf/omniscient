import type {
  BattleAgent,
  BattleConfig,
  BattleEdge,
  BattleEvent,
  BattleNode,
  BattleSnapshot,
  RelationType,
  StoryGenerator,
} from "./types";
import { buildNarrativeSummary, buildLiveNarrative, extractAgentMemory, type LightAgentMemory } from "./narrative/builder";
import { enhanceNarrative, type LLMEnhancerConfig } from "./narrative/llm-enhancer";
import type { NarrativeStyle } from "./narrative/templates";

const DEFAULT_CONFIG = {
  maxTicks: 100,
  defaultHealth: 100,
  attackDamageMin: 12,
  attackDamageMax: 30,
  defendReduction: 0.5,
  allyGuardChance: 0.6,
  seed: Date.now(),
  storyMode: true,
  dynamicConflict: true,
  dynamicConflictProbability: 0.2,
  narrativeStyle: "cinematic" as const,
  llmEnhance: false,
  llmProvider: "openai" as const,
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
};

class RNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T | undefined {
    if (!arr.length) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

function uid(prefix = "evt"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class DefaultStoryGenerator {
  generate(events: BattleEvent[], snapshot: BattleSnapshot): string {
    const last = events.slice(-5);
    const text = last.map((e) => e.text).join(" ");
    return text || `Tick ${snapshot.tick}: the system holds its current balance.`;
  }
}

export class BattleEngine {
  private config: Required<BattleConfig>;
  private rng: RNG;
  private storyGenerator: StoryGenerator;

  private agents: Record<string, BattleAgent> = {};
  private tickCount = 0;
  private finished = false;
  private winner: string | null = null;
  private eventLog: BattleEvent[] = [];
  private hasExplicitConflicts = false;

  constructor(config?: BattleConfig, storyGenerator?: StoryGenerator) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new RNG(this.config.seed);
    this.storyGenerator = storyGenerator ?? new DefaultStoryGenerator();
  }

  loadFromGraph(nodes: BattleNode[], edges: BattleEdge[]): void {
    this.agents = {};
    this.tickCount = 0;
    this.finished = false;
    this.winner = null;
    this.eventLog = [];
    this.hasExplicitConflicts = false;

    for (const node of nodes) {
      const data = node.data ?? {};
      const maxHealth =
        typeof data.health === "number" ? data.health : this.config.defaultHealth;

      this.agents[node.id] = {
        id: node.id,
        name: (data.name as string) ?? node.id,
        health: maxHealth,
        maxHealth,
        alive: true,
        aggression: clamp(
          typeof data.aggression === "number" ? (data.aggression as number) : this.rng.next(),
          0,
          1
        ),
        courage: clamp(
          typeof data.courage === "number" ? (data.courage as number) : this.rng.next(),
          0,
          1
        ),
        loyalty: clamp(
          typeof data.loyalty === "number" ? (data.loyalty as number) : this.rng.next(),
          0,
          1
        ),
        fear: clamp(
          typeof data.fear === "number"
            ? (data.fear as number)
            : this.rng.next() * 0.4,
          0,
          1
        ),
        allies: new Set<string>(),
        foes: new Set<string>(),
        memory: [],
      };

      this.pushEvent({
        tick: 0,
        type: "spawn",
        actor: node.id,
        text: `${node.id} enters the simulation.`,
      });
    }

    for (const edge of edges) {
      const relation = this.normalizeRelation(edge.label);
      if (!this.agents[edge.source] || !this.agents[edge.target]) continue;

      if (relation === "ally") {
        this.agents[edge.source].allies.add(edge.target);
        this.agents[edge.target].allies.add(edge.source);
      } else if (relation === "foe") {
        this.agents[edge.source].foes.add(edge.target);
        this.agents[edge.target].foes.add(edge.source);
        this.hasExplicitConflicts = true;
      }
    }

    if (!this.hasExplicitConflicts) {
      this.pushEvent({
        tick: 0,
        type: "story",
        text: "No explicit conflicts defined. Agents may form hostilities dynamically.",
      });
    }
  }

  step(): BattleSnapshot {
    if (this.finished) return this.snapshot();

    this.tickCount++;
    this.pushEvent({
      tick: this.tickCount,
      type: "turn_start",
      text: `Turn ${this.tickCount} begins.`,
    });

    const aliveAgents = this.getAliveAgents();

    if (aliveAgents.length <= 1) {
      this.finishIfNeeded();
      return this.snapshot();
    }

    if (this.config.dynamicConflict && !this.hasExplicitConflicts) {
      this.maybeCreateDynamicConflict();
    }

    const shuffled = this.rng.shuffle(aliveAgents);

    for (const agent of shuffled) {
      if (!agent.alive || this.finished) continue;

      const actionRoll = this.rng.next();
      const aggressionBias = clamp(agent.aggression + (1 - agent.fear) * 0.25, 0, 1);

      if (actionRoll > aggressionBias) {
        this.pushEvent({
          tick: this.tickCount,
          type: "no_action",
          actor: agent.id,
          text: `${agent.name} holds position.`,
        });
        continue;
      }

      const target = this.chooseTarget(agent);
      if (!target) {
        this.pushEvent({
          tick: this.tickCount,
          type: "no_action",
          actor: agent.id,
          text: `${agent.name} cannot find a target.`,
        });
        continue;
      }

      const defender = this.tryFindDefender(target, agent);
      if (defender) {
        this.resolveAttack(agent, defender, {
          defendedTarget: target.id,
          guard: true,
        });
      } else {
        this.resolveAttack(agent, target);
      }

      this.finishIfNeeded();
      if (this.finished) break;
    }

    this.pushEvent({
      tick: this.tickCount,
      type: "turn_end",
      text: `Turn ${this.tickCount} ends.`,
    });

    this.finishIfNeeded();
    return this.snapshot();
  }

  run(maxSteps = this.config.maxTicks): BattleSnapshot[] {
    const frames: BattleSnapshot[] = [];
    frames.push(this.snapshot());

    for (let i = 0; i < maxSteps; i++) {
      if (this.finished) break;
      frames.push(this.step());
    }

    return frames;
  }

  getState(): BattleSnapshot {
    return this.snapshot();
  }

  getEvents(): BattleEvent[] {
    return [...this.eventLog];
  }

  getNarrative(): string {
    const style: NarrativeStyle = this.config.narrativeStyle ?? "cinematic";
    const memoryMap = extractAgentMemory(this.eventLog);
    return buildNarrativeSummary(this.eventLog, style);
  }

  async getEnhancedNarrative(): Promise<string> {
    const baseNarrative = this.getNarrative();
    
    if (!this.config.llmEnhance || !this.config.llmApiKey) {
      return baseNarrative;
    }

    const llmConfig: LLMEnhancerConfig = {
      enabled: true,
      provider: this.config.llmProvider ?? "openai",
      apiKey: this.config.llmApiKey,
      model: this.config.llmModel,
      style: this.config.narrativeStyle ?? "cinematic",
    };

    return enhanceNarrative(baseNarrative, this.eventLog, llmConfig);
  }

  getStory(): string {
    return this.getNarrative();
  }

  getLiveNarrativeForTick(tick: number): string | null {
    const tickEvents = this.eventLog.filter(e => e.tick === tick);
    if (tickEvents.length === 0) return null;

    const style: NarrativeStyle = this.config.narrativeStyle ?? "cinematic";
    const memoryMap = extractAgentMemory(this.eventLog.slice(0, this.eventLog.findIndex(e => e.tick === tick)));

    const significantEvent = tickEvents.find(e => 
      ["attack", "defend", "death", "alliance_break", "conflict_emerge"].includes(e.type)
    );

    if (!significantEvent) return null;

    return buildLiveNarrative(significantEvent, style, memoryMap);
  }

  hasConflicts(): boolean {
    return this.hasExplicitConflicts;
  }

  private chooseTarget(agent: BattleAgent): BattleAgent | undefined {
    const enemies = this.getAliveAgents().filter(
      (a) =>
        agent.foes.has(a.id) ||
        (!agent.allies.has(a.id) && a.id !== agent.id)
    );

    if (!enemies.length) return undefined;

    enemies.sort((a, b) => {
      const scoreA = a.health + (a.alive ? 0 : 9999);
      const scoreB = b.health + (b.alive ? 0 : 9999);
      return scoreA - scoreB;
    });

    return enemies[0];
  }

  private tryFindDefender(
    target: BattleAgent,
    attacker: BattleAgent
  ): BattleAgent | undefined {
    const potentialDefenders = [...target.allies]
      .map((id) => this.agents[id])
      .filter((a): a is BattleAgent => !!a && a.alive && a.id !== attacker.id);

    if (!potentialDefenders.length) return undefined;

    const sorted = potentialDefenders.sort((a, b) => b.loyalty - a.loyalty);
    const best = sorted[0];

    const guardChance = clamp(
      this.config.allyGuardChance * best.loyalty * (1 - best.fear * 0.5),
      0,
      1
    );

    if (this.rng.chance(guardChance)) return best;
    return undefined;
  }

  private resolveAttack(
    attacker: BattleAgent,
    defender: BattleAgent,
    meta?: Record<string, unknown>
  ): void {
    if (!attacker.alive || !defender.alive) return;

    const baseDamage = this.rng.int(
      this.config.attackDamageMin,
      this.config.attackDamageMax
    );

    let damage = baseDamage;
    let defendedText = "";

    if (meta?.guard) {
      damage = Math.round(damage * (1 - this.config.defendReduction));
      defendedText = ` and is intercepted by ${defender.name}`;
      this.pushEvent({
        tick: this.tickCount,
        type: "defend",
        actor: defender.id,
        target: meta.defendedTarget as string,
        text: `${defender.name} steps in to protect ${meta.defendedTarget}.`,
        metadata: meta,
      });
    }

    defender.health = clamp(defender.health - damage, 0, defender.maxHealth);

    attacker.memory.push({
      id: uid("mem"),
      tick: this.tickCount,
      type: "attack",
      actor: attacker.id,
      target: defender.id,
      text: `${attacker.name} attacked ${defender.name}.`,
      metadata: { damage, ...meta },
    });

    defender.memory.push({
      id: uid("mem"),
      tick: this.tickCount,
      type: "damage",
      actor: attacker.id,
      target: defender.id,
      text: `${defender.name} took ${damage} damage from ${attacker.name}.`,
      metadata: { damage, ...meta },
    });

    this.pushEvent({
      tick: this.tickCount,
      type: "attack",
      actor: attacker.id,
      target: defender.id,
      text: `${attacker.name} attacks ${defender.name}${defendedText} for ${damage} damage.`,
      metadata: { damage, ...meta },
    });

    this.pushEvent({
      tick: this.tickCount,
      type: "damage",
      actor: attacker.id,
      target: defender.id,
      text: `${defender.name} is now at ${defender.health}/${defender.maxHealth} health.`,
      metadata: { health: defender.health },
    });

    if (defender.health <= 0 && defender.alive) {
      defender.alive = false;
      this.pushEvent({
        tick: this.tickCount,
        type: "death",
        actor: attacker.id,
        target: defender.id,
        text: `${defender.name} falls in battle.`,
      });

      for (const allyId of defender.allies) {
        const ally = this.agents[allyId];
        if (!ally || !ally.alive) continue;
        ally.fear = clamp(ally.fear + 0.08, 0, 1);
        ally.loyalty = clamp(ally.loyalty - 0.03, 0, 1);
      }
    }

    attacker.aggression = clamp(attacker.aggression + 0.02, 0, 1);
    attacker.fear = clamp(attacker.fear - 0.01, 0, 1);
    defender.fear = clamp(defender.fear + 0.05, 0, 1);

    if (defender.alive && defender.fear > 0.85) {
      this.breakRandomAlliance(defender);
    }
  }

  private maybeCreateDynamicConflict(): void {
    const aliveAgents = this.getAliveAgents();
    if (aliveAgents.length < 2) return;

    const potentialPairs: [BattleAgent, BattleAgent][] = [];
    for (let i = 0; i < aliveAgents.length; i++) {
      for (let j = i + 1; j < aliveAgents.length; j++) {
        const a = aliveAgents[i];
        const b = aliveAgents[j];
        if (!a.foes.has(b.id) && !b.foes.has(a.id) && !a.allies.has(b.id)) {
          potentialPairs.push([a, b]);
        }
      }
    }

    if (!potentialPairs.length) return;

    const pair = this.rng.pick(potentialPairs);
    if (!pair) return;

    const [a, b] = pair;
    const tension = (a.aggression + b.aggression) / 2 + Math.abs(a.loyalty - b.loyalty);
    const probability = tension * this.config.dynamicConflictProbability;

    if (this.rng.chance(probability)) {
      a.foes.add(b.id);
      b.foes.add(a.id);

      this.pushEvent({
        tick: this.tickCount,
        type: "conflict_emerge",
        actor: a.id,
        target: b.id,
        text: `${a.name} and ${b.name} develop hostility.`,
      });
    }
  }

  private breakRandomAlliance(agent: BattleAgent): void {
    const allies = [...agent.allies].filter((id) => this.agents[id]?.alive);
    if (!allies.length) return;

    const target = this.rng.pick(allies);
    if (!target) return;

    agent.allies.delete(target);
    this.agents[target]?.allies.delete(agent.id);

    this.pushEvent({
      tick: this.tickCount,
      type: "alliance_break",
      actor: agent.id,
      target,
      text: `${agent.name} breaks trust with ${this.agents[target]?.name}.`,
    });
  }

  private getAliveAgents(): BattleAgent[] {
    return Object.values(this.agents).filter((a) => a.alive);
  }

  private finishIfNeeded(): void {
    const alive = this.getAliveAgents();
    if (alive.length <= 1 || this.tickCount >= this.config.maxTicks) {
      this.finished = true;
      this.winner = alive.length === 1 ? alive[0].id : null;

      if (this.winner) {
        this.pushEvent({
          tick: this.tickCount,
          type: "story",
          text: `The simulation ends. ${this.agents[this.winner]?.name} remains standing.`,
        });
      } else {
        this.pushEvent({
          tick: this.tickCount,
          type: "story",
          text: `The simulation ends without a clear victor.`,
        });
      }
    }
  }

  private normalizeRelation(label?: string): RelationType {
    const value = (label ?? "neutral").toLowerCase();
    if (value === "ally") return "ally";
    if (value === "foe" || value === "enemy" || value === "opponent") return "foe";
    return "neutral";
  }

  private pushEvent(partial: Omit<BattleEvent, "id">): void {
    const event: BattleEvent = {
      id: uid("evt"),
      ...partial,
    };

    this.eventLog.push(event);

    if (event.actor && this.agents[event.actor]) {
      this.agents[event.actor].memory.push(event);
    }
    if (event.target && this.agents[event.target]) {
      this.agents[event.target].memory.push(event);
    }
  }

  private snapshot(): BattleSnapshot {
    return {
      tick: this.tickCount,
      agents: Object.fromEntries(
        Object.entries(this.agents).map(([id, agent]) => [
          id,
          {
            ...agent,
            allies: Array.from(agent.allies),
            foes: Array.from(agent.foes),
            memory: [...agent.memory],
          },
        ])
      ),
      recentEvents: this.eventLog.slice(-25),
      finished: this.finished,
      winner: this.winner,
    };
  }
}
