import { Agent, CampaignNode, CausalEventType, EventImpact } from "@/lib/sim/types";


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

export interface NLEventParseResult {
  type: CausalEventType;
  sourceAgentId: string | null;
  targetAgentId: string | null;
  impacts: EventImpact[];
}

export async function parseNLEvent(
  description: string,
  agents: Agent[],
  nodes: CampaignNode[],
  config: AIConfig
): Promise<NLEventParseResult | null> {
  if (!config.apiKey || !description.trim()) {
    return null;
  }

  const prompt = buildNLEventPrompt(description, agents, nodes);
  const normalizedConfig = {
    ...config,
    model: config.model || DEFAULT_MODELS[config.provider],
  };

  try {
    const raw = await callAI(prompt, normalizedConfig);
    const parsed = extractJSON(raw) as Partial<NLEventParseResult>;
    
    if (parsed) {
      return {
        type: parsed.type || "injected",
        sourceAgentId: parsed.sourceAgentId || null,
        targetAgentId: parsed.targetAgentId || null,
        impacts: Array.isArray(parsed.impacts) ? parsed.impacts : [],
      };
    }
  } catch (error) {
    console.error("[AI] NL Event parsing failed:", error);
  }

  return null;
}

function buildNLEventPrompt(description: string, agents: Agent[], nodes: CampaignNode[]): string {
  const agentList = agents.map(a => `- ${a.name} (ID: ${a.id}, Faction: ${a.factionId})`).join("\n");
  const nodeList = nodes.map(n => `- ${n.name} (ID: ${n.id}, Kind: ${n.kind})`).join("\n");

  return `You are parsing a natural language description into a structured simulation consequence.

## Input Description
"${description}"

## Available Actors (Agents)
${agentList || "None"}

## Available Targets (Nodes)
${nodeList || "None"}

## Instructions
Extract the details of the event based on the description. Match the actors and targets to the closest available IDs from the lists above. If no match exists, return null for that field.
Determine the most appropriate 'type' from: "action", "conflict", "negotiation", "trade", "alliance", "betrayal", "natural_event", "injected", "rule_change", "collapse".
Infer the numerical impacts (e.g., morale shift, health loss) based on typical RPG and geopolitical scaling (usually -20 to 20 per event).

Respond with ONLY valid JSON:
{
  "type": "<CausalEventType>",
  "sourceAgentId": "<agent ID or null>",
  "targetAgentId": "<agent ID or null>",
  "impacts": [
    {
      "targetKind": "agent" | "faction" | "region" | "route" | "site" | "front",
      "targetId": "<id of target from lists above>",
      "field": "<stat to change, e.g. 'health', 'morale', 'influence', 'wealth', 'pressure'>",
      "delta": <number, e.g. -15 or 10>
    }
  ]
}`;
}

// ─── Shared AI Call Logic (duplicated minimally for isolation) ─────────
async function callAI(prompt: string, config: AIConfig): Promise<string> {
    let baseUrl = config.baseUrl;
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let endpoint = "/chat/completions";
    let body: Record<string, unknown> = {
      model: config.model,
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    };
  
    switch (config.provider) {
      case "openai":
        baseUrl = baseUrl ?? "https://api.openai.com/v1";
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        break;
      case "gemini":
        baseUrl = baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/openai";
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        break;
      case "anthropic":
        if (baseUrl) {
          headers["Authorization"] = `Bearer ${config.apiKey}`;
        } else {
          baseUrl = "https://api.anthropic.com/v1";
          headers["x-api-key"] = config.apiKey;
          headers["anthropic-version"] = "2023-06-01";
          endpoint = "/messages";
          body = {
            model: config.model,
            max_tokens: 500,
            system: "You output only valid JSON. No markdown.",
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
        break;
    }
  
    const response = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const data = await response.json() as Record<string, any>;
    return data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? "";
}

function extractJSON(text: string): Record<string, any> | null {
    try { return JSON.parse(text); } catch {
      const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
      if (match) { try { return JSON.parse(match[1].trim()); } catch { return null; } }
      const objMatch = /\{[\s\S]*\}/.exec(text);
      if (objMatch) { try { return JSON.parse(objMatch[0]); } catch { return null; } }
      return null;
    }
}
