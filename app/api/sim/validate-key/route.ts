import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API key is required." });
    }

    let success = false;
    let message = "";

    switch (provider) {
      case "openai":
        const oaRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        success = oaRes.ok;
        break;

      case "gemini":
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        success = gemRes.ok;
        break;

      case "anthropic":
        const antRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        success = antRes.ok;
        break;

      case "groq":
        const groqRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        success = groqRes.ok;
        break;

      case "ollama":
        // For local Ollama, we just check if it's reachable (usually http://localhost:11434)
        try {
          const ollamaRes = await fetch("http://localhost:11434/api/tags");
          success = ollamaRes.ok;
          message = success ? "Ollama is reachable." : "Ollama not found at localhost:11434";
        } catch {
          success = false;
          message = "Ollama connection failed.";
        }
        break;

      default:
        message = "Unknown provider.";
    }

    return NextResponse.json({ success, message });
  } catch (err) {
    console.error("Key validation error:", err);
    return NextResponse.json({ success: false, message: "Server error during validation." }, { status: 500 });
  }
}
