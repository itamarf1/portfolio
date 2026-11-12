/* Serverless agent endpoint (Vercel Node function).
   The API key stays here on the server; the browser only sends the conversation.

   Only ONE environment variable is required on the host:
     LLM_API_KEY          a Groq API key (free tier, no card)
   Optional overrides:
     LLM_BASE_URL         any OpenAI-compatible base URL (default: Groq)
     LLM_MODEL            model id (default below)
     ANTHROPIC_API_KEY    use Anthropic instead of LLM_API_KEY
*/
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const KB = require("../kb.js");

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 25;
const hits = new Map(); // best-effort per-instance rate limit

function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > WINDOW_MS) { rec.n = 0; rec.t = now; }
  rec.n += 1;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n > MAX_PER_WINDOW;
}

function clean(raw) {
  const list = Array.isArray(raw) ? raw.slice(-12) : [];
  const out = [];
  for (const m of list) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const content = m.content.slice(0, 1500).trim();
    if (!content) continue;
    if (out.length === 0 && m.role !== "user") continue;      // must start with the visitor
    if (out.length && out[out.length - 1].role === m.role) {   // keep turns alternating
      out[out.length - 1].content += "\n" + content;
    } else out.push({ role: m.role, content });
  }
  while (out.length && out[out.length - 1].role !== "user") out.pop();
  return out;
}

async function callAnthropic(system, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-haiku-5-5",
      max_tokens: 500,
      system,
      messages
    })
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

async function callOpenAICompatible(system, messages) {
  const base = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + process.env.LLM_API_KEY
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      max_tokens: 500,
      messages: [{ role: "system", content: system }].concat(messages)
    })
  });
  if (r.status === 429) { const e = new Error("upstream rate limit"); e.busy = true; throw e; }
  if (!r.ok) throw new Error("llm " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ error: "rate_limited" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const messages = clean(body && body.messages);
  if (!messages.length) return res.status(400).json({ error: "no_question" });

  // Full notes only for the projects this question is about; one-line briefs for the rest.
  const recent = messages.filter(m => m.role === "user").slice(-2).map(m => m.content).join(" ");
  const system = KB.systemPrompt(KB.pick(recent, 2));
  try {
    let text;
    if (process.env.ANTHROPIC_API_KEY) text = await callAnthropic(system, messages);
    else if (process.env.LLM_API_KEY) text = await callOpenAICompatible(system, messages);
    else return res.status(503).json({ error: "not_configured" });
    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    if (err.busy) return res.status(429).json({ error: "busy" });
    return res.status(502).json({ error: "model_error" });
  }
};
