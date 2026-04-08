import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, kind, aiSettings } = body as {
    name: string;
    kind: string;
    aiSettings?: { provider?: string; apiKey?: string; model?: string; baseUrl?: string };
  };

  if (!name || !kind) {
    return NextResponse.json({ error: "name and kind are required" }, { status: 400 });
  }

  const apiKey = aiSettings?.apiKey?.trim();
  if (apiKey) {
    try {
      const description = await generateWithAI(name, kind, {
        provider: aiSettings?.provider ?? "openai",
        apiKey,
        model: aiSettings?.model,
        baseUrl: aiSettings?.baseUrl,
      });
      if (description) return NextResponse.json({ description });
    } catch (err) {
      console.error("[node-description] AI generation failed:", err);
      // Fall through to template
    }
  }

  return NextResponse.json({ description: buildTemplateDescription(name, kind) });
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  ollama: "http://localhost:11434/v1",
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
};

const PROMPT = (name: string, kind: string) =>
  `You are a world-building assistant for a geopolitical simulation game.

Generate a concise character/entity description for a simulation actor named "${name}" with role "${kind}".

Cover:
1. Who they are (real-world or fictional archetype — use real knowledge if the name is recognizable)
2. Their core motivation and primary goal
3. Behavioral tendencies (aggressive, diplomatic, opportunistic, ideological, etc.)
4. Typical methods and style of action
5. Key allegiances or rivalries they'd likely have

Under 120 words. Present tense. Be specific — if the name is recognizable (e.g. "Elon Musk", "Napoleon", "The Vatican", "NATO"), use real knowledge. If fictional, invent a coherent personality.

Respond with ONLY the description text, no labels, no JSON, no preamble.`;

async function generateWithAI(
  name: string,
  kind: string,
  config: { provider: string; apiKey: string; model?: string; baseUrl?: string }
): Promise<string> {
  const provider = config.provider;
  const model = config.model ?? PROVIDER_DEFAULT_MODELS[provider] ?? "gpt-4.1-mini";
  const baseUrl = config.baseUrl ?? PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.openai;

  // Anthropic uses a different API format
  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 250,
        messages: [{ role: "user", content: PROMPT(name, kind) }],
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${err.slice(0, 200)}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text?.trim() ?? "";
  }

  // OpenAI-compatible (openai, gemini, groq, ollama)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: PROMPT(name, kind) }],
      max_tokens: 250,
      temperature: 0.75,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${provider} error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function buildTemplateDescription(name: string, kind: string): string {
  const templates: Record<string, string> = {
    agent: `${name} is an independent actor in the simulation. No AI key configured — add your API key in Settings to auto-generate a real character profile.`,
    faction: `${name} is a faction with collective interests. No AI key configured — add your API key in Settings to auto-generate a faction profile.`,
    front: `${name} is an active conflict front. No AI key configured — add your API key in Settings to auto-generate context.`,
    event: `${name} is a significant event. No AI key configured — add your API key in Settings to auto-generate context.`,
    place: `${name} is a location of strategic importance. No AI key configured — add your API key in Settings to auto-generate context.`,
  };
  return templates[kind] ?? `${name} is a ${kind}. Add your API key in Settings to auto-generate a description.`;
}
