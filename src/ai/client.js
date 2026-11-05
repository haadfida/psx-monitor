// Browser side of the live AI path. Sends only { messages, max_tokens } to the
// /api/claude serverless function; the function owns model, tools and betas.

import { aiRequestHeaders } from "../config/keyMode.js";

/**
 * @param {string} prompt  single user-turn prompt
 * @param {number} maxTokens
 * @returns {Promise<string|null>} concatenated text output, or null on any failure
 */
export async function callClaude(prompt, maxTokens = 16000) {
  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: aiRequestHeaders(),
      body: JSON.stringify({
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      console.warn("AI proxy returned", response.status);
      return null;
    }
    const data = await response.json();
    return typeof data.text === "string" ? data.text : null;
  } catch (err) {
    console.warn("AI proxy unreachable:", err?.message || err);
    return null;
  }
}
