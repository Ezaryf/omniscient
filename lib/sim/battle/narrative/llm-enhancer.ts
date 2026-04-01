import type { NarrativeStyle } from "./templates";
import type { BattleEvent, BattleSnapshot } from "../types";
import type { EventSequence } from "./grouping";

export interface LLMEnhancerConfig {
  enabled: boolean;
  provider: "openai" | "anthropic" | "gemini" | "ollama";
  apiKey?: string;
  model?: string;
  style: NarrativeStyle;
  maxTokens?: number;
}

const DEFAULT_CONFIG: LLMEnhancerConfig = {
  enabled: false,
  provider: "openai",
  model: "gpt-4o-mini",
  style: "cinematic",
  maxTokens: 150,
};

const SYSTEM_PROMPTS: Record<NarrativeStyle, string> = {
  cinematic: `You are a cinematic battle narrator. Transform the following battle events into a vivid, dramatic story.
Constraints:
- Keep it under 80 words
- Maintain logical accuracy
- Add emotion and tension
- Do not invent new events
- Write in present tense for immediacy`,
  military: `You are a precise military report generator. Transform the following battle events into a tactical report.
Constraints:
- Keep it under 60 words
- Maintain operational accuracy
- Use military terminology
- Do not invent new events
- Be concise and factual`,
};

export async function enhanceNarrative(
  baseNarrative: string,
  events: BattleEvent[],
  config: LLMEnhancerConfig,
  sequences?: EventSequence[]
): Promise<string> {
  if (!config.enabled || !config.apiKey) {
    return baseNarrative;
  }

  const eventsJson = JSON.stringify(
    events.slice(-20).map((e) => ({
      type: e.type,
      actor: e.actor,
      target: e.target,
      tick: e.tick,
      text: e.text,
    })),
    null,
    2
  );

  const userPrompt = `Events:
${eventsJson}

Base narrative:
${baseNarrative}`;

  try {
    if (config.provider === "openai") {
      return await enhanceWithOpenAI(
        userPrompt,
        config.apiKey,
        config.model ?? "gpt-4o-mini",
        SYSTEM_PROMPTS[config.style],
        config.maxTokens ?? 150
      );
    }

    if (config.provider === "anthropic") {
      return await enhanceWithAnthropic(
        userPrompt,
        config.apiKey,
        config.model ?? "claude-3-haiku-20240307",
        SYSTEM_PROMPTS[config.style],
        config.maxTokens ?? 150
      );
    }

    if (config.provider === "gemini") {
      return await enhanceWithGemini(
        userPrompt,
        config.apiKey,
        config.model ?? "gemini-1.5-flash-001",
        SYSTEM_PROMPTS[config.style],
        config.maxTokens ?? 150
      );
    }

    return baseNarrative;
  } catch (error) {
    console.error("[LLM Enhancer] Error:", error);
    return baseNarrative;
  }
}

async function enhanceWithOpenAI(
  userPrompt: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function enhanceWithAnthropic(
  userPrompt: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

async function enhanceWithGemini(
  userPrompt: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export function buildLLMPrompt(
  events: BattleEvent[],
  baseNarrative: string,
  style: NarrativeStyle
): string {
  const systemPrompt = SYSTEM_PROMPTS[style];

  const eventsJson = JSON.stringify(
    events.slice(-15).map((e) => ({
      type: e.type,
      actor: e.actor,
      target: e.target,
      tick: e.tick,
    })),
    null,
    2
  );

  return `${systemPrompt}

Events:
${eventsJson}

Base narrative:
${baseNarrative}

Enhance this narrative to be more vivid and engaging while maintaining accuracy.`;
}

export function parseLLMResponse(response: string): string {
  return response.trim();
}
