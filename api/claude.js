// /api/claude.js — Vercel serverless function
//
// Proxies a single analysis request to the Claude API.
//  - Key: the caller's `x-anthropic-key` header (BYOK) wins; otherwise the
//    server env (ANTHROPIC_API_KEY, or legacy VITE_ANTHROPIC_API_KEY).
//    The key is never logged and never echoed back.
//  - Body: only `messages` and `max_tokens` are read from the client. Model,
//    tools, effort and betas are fixed here so the endpoint can't be used as a
//    general-purpose open proxy for arbitrary requests.
//  - Response: { text, stop_reason, model } — just what the UI parses.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_TOKENS_CAP = 16000;
const MAX_MESSAGES = 4;
const MAX_CONTENT_CHARS = 20000;
const MAX_PAUSE_RESUMES = 3;

function pickKey(req) {
  const header = req.headers?.["x-anthropic-key"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    const k = fromHeader.trim();
    return k.length <= 400 ? { key: k, source: "byok" } : { key: null, source: "invalid" };
  }
  const envKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  return envKey ? { key: envKey, source: "server" } : { key: null, source: "none" };
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== "object") return null;

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || !m.content || m.content.length > MAX_CONTENT_CHARS) return null;
    clean.push({ role: m.role, content: m.content });
  }
  if (clean[clean.length - 1].role !== "user") return null;

  const requested = Number.parseInt(body.max_tokens, 10);
  const max_tokens = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  return { messages: clean, max_tokens };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key, source } = pickKey(req);
  if (!key) {
    return res.status(source === "invalid" ? 400 : 401).json({
      error: source === "invalid" ? "Malformed API key header" : "No Anthropic API key configured",
    });
  }

  const input = parseBody(req);
  if (!input) {
    return res.status(400).json({ error: "Expected { messages: [{ role, content: string }], max_tokens? }" });
  }

  const client = new Anthropic({ apiKey: key });
  const messages = [...input.messages];

  try {
    let response;
    for (let attempt = 0; attempt <= MAX_PAUSE_RESUMES; attempt++) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: input.max_tokens,
        // Thinking is always on for this model; effort is the depth control
        // (default is medium — set explicitly so it doesn't drift).
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        // On a safety-classifier decline, re-run server-side on Anthropic's
        // recommended fallback model instead of returning the refusal.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      });
      // Long server-tool turns can pause; resume by sending the partial turn back.
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Request declined", stop_reason: "refusal" });
    }

    const text = (response.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    return res.status(200).json({ text, stop_reason: response.stop_reason, model: response.model });
  } catch (err) {
    // Log only the class and status — never the request headers or key.
    const status = err instanceof Anthropic.APIError && err.status ? err.status : 502;
    console.error(`Claude proxy error (${source}): ${err?.constructor?.name || "Error"} status=${status}`);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Anthropic rejected the API key" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited — try again shortly" });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(status).json({ error: "Claude API error" });
    }
    return res.status(502).json({ error: "Proxy request failed" });
  }
}
