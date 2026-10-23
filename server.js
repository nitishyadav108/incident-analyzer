const express = require("express");
const fs = require("fs");
const { analyzeLog, addCodeChecks } = require("./analyze");

// Sample logs with their saved AI results, so visitors can try the tool without using the API
const SAMPLE_NAMES = {
  "01": "Payment failures",
  "02": "Warnings only",
  "03": "Bad deploy",
  "04": "Vague logs",
  "05": "Prompt injection",
};
const samples = fs.readdirSync(".")
  .filter(f => /^\d\d_.*\.log$/.test(f) && fs.existsSync(`result_${f}.json`))
  .sort()
  .map(f => {
    const log = fs.readFileSync(f, "utf8");
    const raw = fs.readFileSync(`result_${f}.json`, "utf8");
    const result = addCodeChecks(JSON.parse(raw.slice(raw.indexOf("{"))), log);
    const id = f.slice(0, 2);
    return { id, name: SAMPLE_NAMES[id] || f, log, result };
  });

const app = express();
app.set("trust proxy", 1); // hosting platforms sit behind a proxy; this gives the real visitor IP
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

// Allow each visitor 10 analyses per minute, so nobody can drain the API quota
const hits = new Map();
function limiter(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 10) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }
  recent.push(now);
  hits.set(req.ip, recent);
  next();
}

app.get("/samples", (req, res) => {
  res.json(samples.map(s => ({ id: s.id, name: s.name })));
});

app.get("/samples/:id", (req, res) => {
  const s = samples.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "Sample not found." });
  res.json({ ...s, result: { ...s.result, sample: true } });
});

app.post("/analyze", limiter, async (req, res) => {
  try {
    const result = await analyzeLog(req.body.log || "");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port " + PORT));