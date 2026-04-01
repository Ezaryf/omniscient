import type { BattleEvent, BattleSnapshot } from "../types";
import type { NarrativeStyle } from "./templates";
import {
  groupEventsBySequence,
  type EventSequence,
} from "./grouping";
import {
  NARRATIVE_TEMPLATES,
  MEMORY_TEMPLATES,
  getTemplate,
  fillTemplate,
} from "./templates";

export interface LightAgentMemory {
  lastAttacked?: string;
  lastLostAlly?: string;
  lastVictory?: string;
}

export interface NarrativeBuilderConfig {
  style: NarrativeStyle;
  includeMemory: boolean;
}

const DEFAULT_CONFIG: NarrativeBuilderConfig = {
  style: "cinematic",
  includeMemory: true,
};

export function buildSequenceNarrative(
  sequence: EventSequence,
  style: NarrativeStyle,
  agentMemory?: Map<string, LightAgentMemory>
): string {
  const { type, attacker, target, defender, victim, outcome, events } =
    sequence;

  if (type === "death_sequence" && attacker && victim) {
    let template = getTemplate("agent_fell", style);
    let narrative = fillTemplate(template, { victim, attacker });

    if (defender && events.some((e) => e.type === "defend")) {
      template = getTemplate("battle_with_defense_and_death", style);
      narrative = fillTemplate(template, {
        attacker,
        target: victim,
        defender,
      });
    }

    return applyMemory(attacker, "lastVictory", victim, narrative, style);
  }

  if (type === "alliance_shift" && sequence.actor && sequence.target) {
    const template = getTemplate("alliance_broken", style);
    return fillTemplate(template, {
      actor: sequence.actor,
      target: sequence.target,
    });
  }

  if (type === "conflict_emerge" && sequence.actor && sequence.target) {
    const template = getTemplate("conflict_emerged", style);
    return fillTemplate(template, {
      actor: sequence.actor,
      target: sequence.target,
    });
  }

  if (type === "battle_sequence") {
    const hasDefense = !!defender;
    const died = events.some((e) => e.type === "death");

    if (hasDefense && died) {
      const template = getTemplate("battle_with_defense_and_death", style);
      return fillTemplate(template, {
        attacker: attacker ?? "Unknown",
        target: target ?? "Unknown",
        defender: defender ?? "Unknown",
      });
    }

    if (hasDefense) {
      const template = getTemplate("battle_with_defense_survived", style);
      return fillTemplate(template, {
        attacker: attacker ?? "Unknown",
        target: target ?? "Unknown",
        defender: defender ?? "Unknown",
      });
    }

    const template = getTemplate("battle_without_defense", style);
    return fillTemplate(template, {
      attacker: attacker ?? "Unknown",
      target: target ?? "Unknown",
    });
  }

  if (type === "standoff" || events.every((e) => e.type === "no_action")) {
    const noActionEvent = events.find((e) => e.type === "no_action");
    if (noActionEvent?.actor) {
      const template = getTemplate("hold_position", style);
      return fillTemplate(template, { actor: noActionEvent.actor });
    }
    return getTemplate("standoff", style);
  }

  return getTemplate("standoff", style);
}

export function applyMemory(
  agentId: string,
  memoryType: "lastVictory" | "lastLostAlly" | "lastAttacked",
  context: string,
  baseNarrative: string,
  style: NarrativeStyle
): string {
  if (!baseNarrative) return baseNarrative;

  const memoryTemplate = MEMORY_TEMPLATES[memoryType];
  if (!memoryTemplate) return baseNarrative;

  const template = memoryTemplate[style] ?? memoryTemplate.cinematic;
  const action = baseNarrative.toLowerCase();

  const enriched = fillTemplate(template, {
    agent: agentId,
    ally: context,
    attacker: context,
    victim: context,
    action,
  });

  return enriched;
}

export function buildLiveNarrative(
  event: BattleEvent,
  style: NarrativeStyle,
  agentMemory?: Map<string, LightAgentMemory>
): string {
  const { type, actor, target, text } = event;

  if (type === "spawn") {
    const template = getTemplate("spawn", style);
    return fillTemplate(template, { actor: actor ?? "Unknown" });
  }

  if (type === "no_action") {
    const template = getTemplate("no_target", style);
    return fillTemplate(template, { actor: actor ?? "Unknown" });
  }

  if (type === "attack" && actor && target) {
    return text;
  }

  if (type === "defend" && actor && target) {
    const template = getTemplate("defender_intercepts", style);
    return fillTemplate(template, {
      defender: actor,
      attacker: target,
      target,
    });
  }

  if (type === "death" && target) {
    const template = getTemplate("agent_fell", style);
    return fillTemplate(template, { victim: target, attacker: actor ?? "Unknown" });
  }

  if (type === "alliance_break" && actor && target) {
    const template = getTemplate("alliance_broken", style);
    return fillTemplate(template, { actor, target });
  }

  if (type === "conflict_emerge" && actor && target) {
    const template = getTemplate("conflict_emerged", style);
    return fillTemplate(template, { actor, target });
  }

  return text;
}

export function buildFinalNarrative(
  events: BattleEvent[],
  snapshot: BattleSnapshot,
  style: NarrativeStyle,
  agentMemory?: Map<string, LightAgentMemory>
): string {
  const sequences = groupEventsBySequence(events);
  const paragraphs: string[] = [];

  for (const sequence of sequences) {
    const narrative = buildSequenceNarrative(sequence, style, agentMemory);
    if (narrative) {
      paragraphs.push(narrative);
    }
  }

  if (snapshot.finished) {
    if (snapshot.winner) {
      const template = getTemplate("victory", style);
      const victoryNarrative = fillTemplate(template, { winner: snapshot.winner });
      paragraphs.push(victoryNarrative);
    } else {
      const template = getTemplate("mutual_destruction", style);
      paragraphs.push(template);
    }
  }

  return paragraphs.join(" ");
}

export function extractAgentMemory(
  events: BattleEvent[]
): Map<string, LightAgentMemory> {
  const memoryMap = new Map<string, LightAgentMemory>();

  for (const event of events) {
    if (!event.actor && !event.target) continue;

    if (event.type === "death" && event.target && event.actor) {
      const targetMemory = memoryMap.get(event.target) ?? {};
      targetMemory.lastLostAlly = event.target;

      for (const [agentId, memory] of memoryMap) {
        if (memory.lastAttacked === event.target) {
          memory.lastVictory = event.target;
          delete memory.lastAttacked;
        }
      }

      memoryMap.set(event.target, targetMemory);
    }

    if (event.type === "attack" && event.actor && event.target) {
      const actorMemory = memoryMap.get(event.actor) ?? {};
      actorMemory.lastAttacked = event.target;
      memoryMap.set(event.actor, actorMemory);
    }

    if (event.type === "death" && event.actor) {
      const actorMemory = memoryMap.get(event.actor) ?? {};
      actorMemory.lastVictory = event.target;
      memoryMap.set(event.actor, actorMemory);
    }
  }

  return memoryMap;
}

export function buildNarrativeSummary(
  events: BattleEvent[],
  style: NarrativeStyle = "cinematic"
): string {
  const memoryMap = extractAgentMemory(events);
  const snapshot: BattleSnapshot = {
    tick: events[events.length - 1]?.tick ?? 0,
    agents: {},
    recentEvents: events.slice(-10),
    finished: events.some((e) => e.type === "story" && e.text.includes("ends")),
    winner: null,
  };

  const deaths = events.filter((e) => e.type === "death");
  const attacks = events.filter((e) => e.type === "attack");
  const defenses = events.filter((e) => e.type === "defend");

  const lines: string[] = [];

  if (attacks.length > 0) {
    const lastAttack = attacks[attacks.length - 1];
    if (lastAttack?.actor) {
      lines.push(
        buildLiveNarrative(lastAttack, style, memoryMap)
      );
    }
  }

  if (defenses.length > 0) {
    const lastDefend = defenses[defenses.length - 1];
    if (lastDefend) {
      lines.push(buildLiveNarrative(lastDefend, style, memoryMap));
    }
  }

  if (deaths.length > 0) {
    const lastDeath = deaths[deaths.length - 1];
    if (lastDeath) {
      lines.push(buildLiveNarrative(lastDeath, style, memoryMap));
    }
  }

  if (snapshot.finished) {
    const victoryEvent = events.find(
      (e) => e.type === "story" && e.text.includes("remains standing")
    );
    if (victoryEvent) {
      lines.push(victoryEvent.text);
    } else {
      lines.push(getTemplate("mutual_destruction", style));
    }
  }

  return lines.join(" ");
}
