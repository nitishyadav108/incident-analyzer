require("dotenv").config();
const fs = require("fs");
const crypto = require("crypto");
const { summarizeLog, buildTimeline } = require("./countErrors");

const MODEL = "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function getLines(text) {
  return text.split("\n").filter(line => line.trim() !== "");
}

function numberLines(text) {
  return getLines(text)
    .map((line, i) => `L${String(i + 1).padStart(3, "0")} | ${line}`)
    .join("\n");
}

// Lowercase and collapse spaces, so "ERROR payment-api    Timeout" matches "error payment-api timeout"
function normalize(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Check every quote the AI cites really appears on the line it names.
// A quote shortened with "..." passes if each part is on that line.
function quoteOnLine(quote, lineText) {
  const parts = normalize(quote)
    .replace(/^["']|["']$/g, "")
    .split(/\.\.\.|…/)
    .map(p => p.trim())
    .filter(Boolean);
  const line = normalize(lineText);
  return parts.length > 0 && parts.every(p => line.includes(p));
}

// Everything here is plain code, so it costs no AI tokens.
// It is also applied to the saved sample results.
function addCodeChecks(result, logText) {
  const lines = getLines(logText);
  const exists = n => Number.isInteger(n) && n >= 1 && n <= lines.length;

  result.key_errors = summarizeLog(logText); // counts come from code, not from the AI
  result.timeline = buildTimeline(logText);

  const evidence = (result.likely_cause && result.likely_cause.evidence) || [];
  evidence.forEach(e => {
    e.verified = exists(e.line) && quoteOnLine(e.quote, lines[e.line - 1]);
  });
  result.evidence_check = { verified: evidence.filter(e => e.verified).length, total: evidence.length };

  // Drop line references that do not exist in the log
  (result.recommended_solutions || []).forEach(s => {
    s.lines = (s.lines || []).filter(exists);
  });
  return result;
}

// Same log + same prompt → reuse the earlier answer instead of calling the AI again
const cache = new Map();
const CACHE_LIMIT = 100;

async function analyzeLog(logText) {
  if (!logText || logText.trim() === "") {
    throw new Error("No log text provided.");
  }
  if (logText.length > 100000) {
    throw new Error("Log is too large (limit is 100,000 characters).");
  }

  const systemPrompt = fs.readFileSync("prompt.md", "utf8");
  const key = crypto.createHash("sha256").update(systemPrompt + "\0" + logText.trim()).digest("hex");
  if (cache.has(key)) {
    return { ...structuredClone(cache.get(key)), cached: true };
  }

  const numbered = numberLines(logText);
  const stats = summarizeLog(logText);

  const userMessage =
    "PRE-COMPUTED STATISTICS (calculated by code, exact):\n" +
    JSON.stringify(stats, null, 2) +
    "\n\nNUMBERED LOG:\n" +
    numbered;

  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error("AI service error: " + JSON.stringify(data.error || data));
  }

  const rawText = data.candidates[0].content.parts[0].text;
  let result;
  try {
    result = JSON.parse(rawText);
  } catch (err) {
    throw new Error("The AI did not return valid JSON.");
  }
  addCodeChecks(result, logText);

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value); // forget the oldest
  cache.set(key, structuredClone(result));
  return result;
}

module.exports = { analyzeLog, addCodeChecks };

if (require.main === module) {
  const text = fs.readFileSync(process.argv[2], "utf8");
  analyzeLog(text)
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error(e.message));
}
