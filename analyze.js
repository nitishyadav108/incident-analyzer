require("dotenv").config();
const fs = require("fs");
const { summarizeLog } = require("./countErrors");

const MODEL = "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function numberLines(text) {
  return text
    .split("\n")
    .filter(line => line.trim() !== "")
    .map((line, i) => `L${String(i + 1).padStart(3, "0")} | ${line}`)
    .join("\n");
}

async function analyzeLog(logText) {
  if (!logText || logText.trim() === "") {
    throw new Error("No log text provided.");
  }
  if (logText.length > 100000) {
    throw new Error("Log is too large (limit is 100,000 characters).");
  }

  const numbered = numberLines(logText);
  const stats = summarizeLog(logText);
  const systemPrompt = fs.readFileSync("prompt.md", "utf8");

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
  result.key_errors = stats; // counts come from code, not from the AI
  return result;
}

module.exports = { analyzeLog };

if (require.main === module) {
  const text = fs.readFileSync(process.argv[2], "utf8");
  analyzeLog(text)
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error(e.message));
}