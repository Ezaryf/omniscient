import type { BattleEvent, EventType } from "../types";

export type SequenceType =
  | "battle_sequence"
  | "death_sequence"
  | "alliance_shift"
  | "conflict_emerge"
  | "standoff";

export interface EventSequence {
  id: string;
  type: SequenceType;
  tick: number;
  events: BattleEvent[];
  attacker?: string;
  target?: string;
  defender?: string;
  victim?: string;
  winner?: string;
  actor?: string;
  outcome: "victory" | "defeat" | "draw" | "ongoing";
}

export function groupEventsBySequence(events: BattleEvent[]): EventSequence[] {
  const sequences: EventSequence[] = [];
  let currentSequence: BattleEvent[] = [];
  let currentTick = -1;

  for (const event of events) {
    if (event.tick !== currentTick) {
      if (currentSequence.length > 0) {
        const seq = buildSequence(currentSequence);
        if (seq) sequences.push(seq);
        currentSequence = [];
      }
      currentTick = event.tick;
    }

    if (isSignificantEvent(event)) {
      currentSequence.push(event);
    }
  }

  if (currentSequence.length > 0) {
    const seq = buildSequence(currentSequence);
    if (seq) sequences.push(seq);
  }

  return sequences;
}

function isSignificantEvent(event: BattleEvent): boolean {
  const significantTypes: EventType[] = [
    "attack",
    "defend",
    "damage",
    "death",
    "alliance_break",
    "conflict_emerge",
  ];
  return significantTypes.includes(event.type);
}

function buildSequence(events: BattleEvent[]): EventSequence | null {
  if (events.length === 0) return null;

  const firstEvent = events[0];
  const tick = firstEvent.tick;

  const deathEvent = events.find((e) => e.type === "death");
  const attackEvent = events.find((e) => e.type === "attack");
  const defendEvent = events.find((e) => e.type === "defend");
  const allianceBreakEvent = events.find((e) => e.type === "alliance_break");
  const conflictEmmergeEvent = events.find((e) => e.type === "conflict_emerge");

  if (deathEvent) {
    return {
      id: `death_${tick}`,
      type: "death_sequence",
      tick,
      events,
      victim: deathEvent.target,
      attacker: deathEvent.actor,
      outcome: "defeat",
    };
  }

  if (allianceBreakEvent) {
    return {
      id: `alliance_${tick}`,
      type: "alliance_shift",
      tick,
      events,
      actor: allianceBreakEvent.actor,
      target: allianceBreakEvent.target,
      outcome: "ongoing",
    };
  }

  if (conflictEmmergeEvent) {
    return {
      id: `conflict_${tick}`,
      type: "conflict_emerge",
      tick,
      events,
      actor: conflictEmmergeEvent.actor,
      target: conflictEmmergeEvent.target,
      outcome: "ongoing",
    };
  }

  if (attackEvent) {
    const hasDefense = !!defendEvent;
    const outcome: EventSequence["outcome"] = hasDefense
      ? "ongoing"
      : "victory";

    return {
      id: `battle_${tick}`,
      type: "battle_sequence",
      tick,
      events,
      attacker: attackEvent.actor,
      target: attackEvent.target,
      defender: defendEvent?.actor,
      outcome,
    };
  }

  return {
    id: `other_${tick}`,
    type: "standoff",
    tick,
    events,
    outcome: "ongoing",
  };
}

export function extractActorsFromSequence(sequence: EventSequence): string[] {
  const actors = new Set<string>();

  for (const event of sequence.events) {
    if (event.actor) actors.add(event.actor);
    if (event.target) actors.add(event.target);
  }

  return Array.from(actors);
}

export function calculateSequenceOutcome(
  sequence: EventSequence
): "victory" | "defeat" | "draw" | "ongoing" {
  const deathEvents = sequence.events.filter((e) => e.type === "death");

  if (deathEvents.length === 0) {
    return "ongoing";
  }

  const uniqueKillers = new Set(
    deathEvents.map((e) => e.actor).filter(Boolean)
  );
  const uniqueVictims = new Set(
    deathEvents.map((e) => e.target).filter(Boolean)
  );

  if (uniqueKillers.size === 1 && uniqueVictims.size > 0) {
    return "victory";
  }

  if (uniqueVictims.size > uniqueKillers.size) {
    return "defeat";
  }

  return "draw";
}

export function getSequenceSummary(sequence: EventSequence): string {
  const { type, attacker, target, defender, victim, outcome } = sequence;

  switch (type) {
    case "death_sequence":
      return `${victim} was eliminated by ${attacker}`;
    case "alliance_shift":
      return `Alliance broken between ${sequence.actor} and ${sequence.target}`;
    case "conflict_emerge":
      return `Conflict emerged between ${sequence.actor} and ${sequence.target}`;
    case "battle_sequence":
      if (defender) {
        return `${attacker} attacked ${target}, ${defender} defended`;
      }
      return `${attacker} attacked ${target}`;
    default:
      return "A battle unfolded";
  }
}
