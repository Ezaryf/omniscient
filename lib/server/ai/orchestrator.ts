/**
 * AI Orchestrator — server-side AI call management.
 * Builds prompts → calls OpenAI-compatible API → validates → falls back to heuristics.
 * Separates AI rationale from simulation truth.
 */

import type { Agent, ActionProposal, CampaignSetupDraft, WorldState } from "@/lib/sim/types";
import {
  validateProposal,
  checkConstraints,
  meetsConfidenceThreshold,
} from "@/lib/sim/ai/proposal";
import { generateFallbackProposal } from "@/lib/sim/ai/fallback";
import { AICache } from "./cache";
import { CampaignSetupDraftSchema } from "@/lib/sim/types";
import { buildFallbackCampaignSetupDraft } from "@/lib/sim/setup";
import { buildActionPrompt, buildExplanationPrompt, buildNarrativePrompt, buildGroupActionPrompt, buildSimulationDescriptionPrompt, buildCampaignSetupPrompt, buildActorDescriptionPrompt } from "./prompts";
import { createRng } from "@/lib/sim/seed";
import { getStore } from "../store";

const proposalCache = new AICache<ActionProposal>();

interface AIConfig {
  provider: "openai" | "anthropic" | "gemini" | "groq" | "ollama";
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const DEFAULT_MODELS: Record<AIConfig["provider"], string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-sonnet-20241022",
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
};

const DEPRECATED_MODEL_MIGRATIONS: Record<string, string> = {
  "llama3-70b-8192": "llama-3.3-70b-versatile",
  "llama3-8b-8192": "llama-3.1-8b-instant",
};

/**
 * Get action proposals for all alive agents in a branch.
 * Uses AI when available, falls back to heuristics otherwise.
 */
export async function getActionProposals(
  branchId: string,
  worldState: WorldState,
  stateHash: string,
  config: AIConfig | null
): Promise<{ proposals: ActionProposal[]; source: "ai" | "heuristic" | "ledger" }> {
  const normalizedConfig = config ? normalizeAiConfig(config) : null;

  // 1. Check Permanent Ledger (Direct match for this branch/tick)
  const store = getStore();
  const ledgerMatch = await store.getProposals(branchId, worldState.tick);
  if (ledgerMatch) {
    return { proposals: ledgerMatch as ActionProposal[], source: "ledger" };
  }

  const aliveAgents = worldState.agents.filter((a) => a.status === "alive");

  // If no AI config, use heuristics
  if (!normalizedConfig?.apiKey) {
    const rng = createRng(worldState.seed + worldState.tick * 1000);
    const proposals = aliveAgents
      .map((agent) => generateFallbackProposal(agent, worldState.agents, worldState.relationships, rng))
      .filter((p): p is ActionProposal => p !== null);

    return { proposals, source: "heuristic" };
  }

  // --- Group Think Logic ---
  // Group agents by faction
  const factionGroups: Record<string, Agent[]> = {};
  aliveAgents.forEach(a => {
    if (!factionGroups[a.factionId]) factionGroups[a.factionId] = [];
    factionGroups[a.factionId].push(a);
  });

  const results: ActionProposal[] = [];
  const factionIds = Object.keys(factionGroups);

  // Process factions in parallel (limited chunks)
  const CHUNK_SIZE = 3;
  for (let i = 0; i < factionIds.length; i += CHUNK_SIZE) {
    const chunk = factionIds.slice(i, i + CHUNK_SIZE);
    
    const chunkPromises = chunk.map(async (fid) => {
      const agents = factionGroups[fid];
      
      // If single agent, use individual prompt (or if faction is null)
      if (agents.length === 1 || fid === "unaligned") {
        const agent = agents[0];
        const cacheKey = AICache.buildKey(stateHash, worldState.tick, agent.id);
        const cached = proposalCache.get(cacheKey);
        if (cached) return [cached];

        const p = await getAgentProposal(agent, worldState, normalizedConfig);
        if (p) {
          proposalCache.set(cacheKey, p);
          return [p];
        }
        return [makeFallback(agent, worldState)].filter((x): x is ActionProposal => x !== null);
      }

      // Group Think call
      try {
        const prompt = buildGroupActionPrompt(fid, agents, worldState);
        const raw = await callAI(prompt, normalizedConfig);
        const parsed = extractJSON(raw) as { proposals: ActionProposal[] } | null;
        
        if (parsed?.proposals && Array.isArray(parsed.proposals)) {
          // Validate and cache each
          return parsed.proposals.map(p => {
            const validation = validateProposal(p);
            const finalP = validation.ok ? p : makeFallback(agents.find(a => a.id === p.agentId) || agents[0], worldState);
            if (finalP) {
              const cacheKey = AICache.buildKey(stateHash, worldState.tick, finalP.agentId);
              proposalCache.set(cacheKey, finalP);
            }
            return finalP;
          }).filter((x): x is ActionProposal => x !== null);
        }
      } catch (err) {
        console.error(`[GroupThink] Error for faction ${fid}:`, err);
      }

      // Individual fallbacks for group failure
      return agents.map(a => makeFallback(a, worldState)).filter((x): x is ActionProposal => x !== null);
    });

    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(r => results.push(...r));

    if (i + CHUNK_SIZE < factionIds.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // 4. Persist to ledger
  if (results.length > 0) {
    await store.saveProposals(branchId, worldState.tick, results);
  }

  return {
    proposals: results,
    source: results.length > 0 ? "ai" : "heuristic",
  };
}

/**
 * Get a single action proposal for an agent.
 * Validates and falls back on failure.
 */
async function getAgentProposal(
  agent: Agent,
  worldState: WorldState,
  config: AIConfig
): Promise<ActionProposal | null> {
  try {
    const prompt = buildActionPrompt(agent, worldState);
    const rawResponse = await callAI(prompt, config);

    // Parse JSON from response
    const parsed = extractJSON(rawResponse);
    if (!parsed) {
      console.warn(`[AI] Failed to parse JSON for agent ${agent.name}`);
      return makeFallback(agent, worldState);
    }

    // Validate against schema
    const validation = validateProposal(parsed);
    if (!validation.ok) {
      console.warn(
        `[AI] Invalid proposal for ${agent.name}:`,
        validation.errors
      );
      return makeFallback(agent, worldState);
    }

    // Check confidence threshold
    if (
      !meetsConfidenceThreshold(
        validation.proposal,
        worldState.rules.aiConfidenceFloor
      )
    ) {
      console.warn(
        `[AI] Low confidence (${validation.proposal.confidence}) for ${agent.name}`
      );
      return makeFallback(agent, worldState);
    }

    // Check hard constraints
    const constraint = checkConstraints(
      validation.proposal,
      worldState.agents
    );
    if (!constraint.allowed) {
      console.warn(
        `[AI] Constraint violation for ${agent.name}: ${constraint.reason}`
      );
      return makeFallback(agent, worldState);
    }

    return validation.proposal;
  } catch (error) {
    console.error(`[AI] Error getting proposal for ${agent.name}:`, error);
    return makeFallback(agent, worldState);
  }
}

function makeFallback(agent: Agent, worldState: WorldState): ActionProposal | null {
  const rng = createRng(
    worldState.seed + worldState.tick * 1000 + hashString(agent.id)
  );
  return generateFallbackProposal(
    agent,
    worldState.agents,
    worldState.relationships,
    rng
  );
}

/**
 * Generate an explanation for an event or agent action.
 */
export async function generateExplanation(
  description: string,
  worldState: WorldState,
  config: AIConfig | null
): Promise<{
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  generatedBy: "ai" | "heuristic";
} | null> {
  const normalizedConfig = config ? normalizeAiConfig(config) : null;

  if (!normalizedConfig?.apiKey) {
    return {
      title: "Heuristic Analysis",
      summary: `${description} — driven by agent goals and relationship dynamics.`,
      evidence: [],
      confidence: 0.3,
      generatedBy: "heuristic",
    };
  }

  try {
    const prompt = buildExplanationPrompt(description, worldState);
    const raw = await callAI(prompt, normalizedConfig);
    const parsed = extractJSON(raw);

    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, any>;
      return {
        title: typeof data.title === "string" ? data.title : "AI Analysis",
        summary: typeof data.summary === "string" ? data.summary : description,
        evidence: Array.isArray(data.evidence) ? data.evidence : [],
        confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
        generatedBy: "ai",
      };
    }
  } catch (error) {
    console.error("[AI] Explanation generation failed:", error);
  }

  return null;
}

/**
 * Generate a narrative summary of the current branch state.
 */
export async function generateNarrative(
  worldState: WorldState,
  config: AIConfig | null
): Promise<{
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  generatedBy: "ai" | "heuristic";
} | null> {
  const normalizedConfig = config ? normalizeAiConfig(config) : null;

  if (!normalizedConfig?.apiKey) {
    const topAgent = [...worldState.agents]
      .filter((a) => a.status === "alive")
      .sort((a, b) => b.state.influence - a.state.influence)[0];

    return {
      title: `Tick ${worldState.tick}: ${topAgent?.name ?? "Unknown"} leads`,
      summary: `At tick ${worldState.tick}, ${topAgent?.name ?? "the world"} holds the most influence. ${worldState.events.length} events have shaped this timeline.`,
      evidence: worldState.events.slice(-3).map((e) => e.description),
      confidence: 0.3,
      generatedBy: "heuristic",
    };
  }

  try {
    const prompt = buildNarrativePrompt(worldState);
    const raw = await callAI(prompt, normalizedConfig);
    const parsed = extractJSON(raw);

    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, any>;
      return {
        title: typeof data.title === "string" ? data.title : "Narrative",
        summary: typeof data.summary === "string" ? data.summary : "",
        evidence: Array.isArray(data.evidence) ? data.evidence : [],
        confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
        generatedBy: "ai",
      };
    }
  } catch (error) {
    console.error("[AI] Narrative generation failed:", error);
  }

  return null;
}

export async function generateSimulationDescription(
  name: string,
  config: AIConfig | null
): Promise<string | null> {
  const normalizedConfig = config ? normalizeAiConfig(config) : null;
  if (!normalizedConfig?.apiKey || !name.trim()) {
    return null;
  }

  try {
    const prompt = buildSimulationDescriptionPrompt(name.trim());
    const raw = await callAI(prompt, normalizedConfig);
    const parsed = extractJSON(raw);

    if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).description === "string") {
      return ((parsed as Record<string, unknown>).description as string).trim();
    }
  } catch (error) {
    console.error("[AI] Simulation description generation failed:", error);
  }

  return null;
}

export async function generateCampaignSetup(
  name: string,
  description: string | undefined,
  config: AIConfig | null
): Promise<CampaignSetupDraft> {
  const normalizedConfig = config ? normalizeAiConfig(config) : null;
  if (!name.trim() || !normalizedConfig?.apiKey) {
    return buildFallbackCampaignSetupDraft(name, description);
  }

  try {
    const prompt = buildCampaignSetupPrompt(name.trim(), description);
    const raw = await callAI(prompt, normalizedConfig);
    const parsed = extractJSON(raw);
    const validation = CampaignSetupDraftSchema.safeParse(parsed);

    if (validation.success) {
      const draft = {
        ...validation.data,
        generatedBy: "ai" as const,
      };

      // Generate descriptions for each actor
      console.log(`[AI] Generating descriptions for ${draft.actors.length} actors...`);
      const actorsWithDescriptions = await Promise.all(
        draft.actors.map(async (actor) => {
          try {
            const descPrompt = buildActorDescriptionPrompt(actor.name, actor.type, actor.role);
            const descRaw = await callAIText(descPrompt, normalizedConfig);
            const description = descRaw.trim();
            console.log(`[AI] Generated description for ${actor.name}: ${description.substring(0, 50)}...`);
            return { ...actor, description };
          } catch (error) {
            console.error(`[AI] Failed to generate description for actor ${actor.name}:`, error);
            return { ...actor, description: "" };
          }
        })
      );

      console.log(`[AI] Successfully generated ${actorsWithDescriptions.filter(a => a.description).length} descriptions`);
      return {
        ...draft,
        actors: actorsWithDescriptions,
      };
    }
  } catch (error) {
    console.error("[AI] Campaign setup generation failed:", error);
  }

  return buildFallbackCampaignSetupDraft(name, description);
}

// ─── Helpers ─────────────────────────────────────────────────────

async function callAI(prompt: string, config: AIConfig): Promise<string> {
  return callAIWithMode(prompt, config, "json");
}

async function callAIText(prompt: string, config: AIConfig): Promise<string> {
  return callAIWithMode(prompt, config, "text");
}

async function callAIWithMode(prompt: string, config: AIConfig, mode: "json" | "text"): Promise<string> {
  let baseUrl = config.baseUrl;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let endpoint = "/chat/completions";
  const systemMessage = mode === "json" 
    ? "You are a simulation engine that outputs only valid JSON. No markdown, no explanation, just JSON."
    : "You are a helpful assistant that provides clear, concise responses.";
  
  let body: Record<string, unknown> = {
    model: config.model,
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 800,
  };

  // Provider-specific routing and auth
  switch (config.provider) {
    case "openai":
      baseUrl = baseUrl ?? "https://api.openai.com/v1";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;
    case "gemini":
      // Use the OpenAI-compatible endpoint for Gemini
      baseUrl = baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/openai";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;
    case "anthropic":
      // Anthropic requires a different header format than OpenAI-compatible proxies
      // We'll use the official messages API format if we can,
      // but for now we assume the user might be using a proxy if baseUrl is set.
      if (baseUrl) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      } else {
        baseUrl = "https://api.anthropic.com/v1";
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        endpoint = "/messages";
        body = {
          model: config.model,
          max_tokens: 800,
          system: systemMessage,
          messages: [{ role: "user", content: prompt }],
        };
      }
      break;
    case "groq":
      baseUrl = baseUrl ?? "https://api.groq.com/openai/v1";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;
    case "ollama":
      baseUrl = baseUrl ?? "http://localhost:11434/v1";
      // No auth usually needed for local Ollama
      break;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AI API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 400)}` : ""}`
    );
  }

  if (config.provider === "anthropic" && !config.baseUrl) {
    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return data.content?.find((entry) => entry.type === "text")?.text ?? "";
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }

    // Try to find JSON object in text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeAiConfig(config: AIConfig): AIConfig {
  const fallbackModel = DEFAULT_MODELS[config.provider];
  const migratedModel = DEPRECATED_MODEL_MIGRATIONS[config.model] ?? config.model ?? fallbackModel;
  return {
    ...config,
    model: migratedModel || fallbackModel,
  };
}
