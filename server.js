const express = require("express");
const { analyzeLog } = require("./analyze");

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