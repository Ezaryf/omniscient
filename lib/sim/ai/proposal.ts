/**
 * ActionProposal validation and conversion.
 * Validates AI-generated structured output and converts to canonical sim events.
 */

import { z } from "zod";
import { ActionProposalSchema, type ActionProposal, type Agent } from "../types";

/**
 * Validate a raw AI response against the ActionProposal schema.
 * Returns the validated proposal or a list of errors.
 */
export function validateProposal(
  raw: unknown
): { ok: true; proposal: ActionProposal } | { ok: false; errors: string[] } {
  const result = ActionProposalSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, proposal: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (e) => `${e.path.map(String).join(".")}: ${e.message}`
    ),
  };
}

/**
 * Batch-validate multiple proposals from an AI response.
 */
export function validateProposalBatch(
  rawBatch: unknown[]
): {
  valid: ActionProposal[];
  invalid: { index: number; errors: string[] }[];
} {
  const valid: ActionProposal[] = [];
  const invalid: { index: number; errors: string[] }[] = [];

  for (let i = 0; i < rawBatch.length; i++) {
    const result = validateProposal(rawBatch[i]);
    if (result.ok) {
      valid.push(result.proposal);
    } else {
      invalid.push({ index: i, errors: result.errors });
    }
  }

  return { valid, invalid };
}

/**
 * Check if a proposal conflicts with hard constraints.
 * Returns true if the proposal is allowed.
 */
export function checkConstraints(
  proposal: ActionProposal,
  agents: Agent[]
): { allowed: boolean; reason?: string } {
  const agent = agents.find((a) => a.id === proposal.agentId);
  if (!agent) {
    return { allowed: false, reason: "Agent not found" };
  }
  if (agent.status !== "alive") {
    return { allowed: false, reason: `Agent is ${agent.status}` };
  }

  if (proposal.targetAgentId) {
    const target = agents.find((a) => a.id === proposal.targetAgentId);
    if (!target) {
      return { allowed: false, reason: "Target agent not found" };
    }
    if (target.status !== "alive") {
      return { allowed: false, reason: `Target is ${target.status}` };
    }
  }

  // Cannot attack/betray an agent in the same faction
  if (
    (proposal.actionType === "attack" || proposal.actionType === "betray") &&
    proposal.targetAgentId
  ) {
    const target = agents.find((a) => a.id === proposal.targetAgentId);
    if (target && target.factionId === agent.factionId) {
      return { allowed: false, reason: "Cannot attack own faction member" };
    }
  }

  return { allowed: true };
}

/**
 * Check if a proposal meets the confidence threshold.
 */
export function meetsConfidenceThreshold(
  proposal: ActionProposal,
  floor: number
): boolean {
  return proposal.confidence >= floor;
}
