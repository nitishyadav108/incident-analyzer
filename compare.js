const fs = require("fs");

const files = fs.readdirSync(".").filter(f => f.startsWith("result_")).sort();

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const start = raw.indexOf("{");
  console.log("\n=== " + f);
  try {
    const r = JSON.parse(raw.slice(start));
    console.log("Severity:   ", r.severity.level);
    console.log("Confidence: ", r.likely_cause.confidence);
    console.log("Cause:      ", r.likely_cause.statement);
    console.log("Escalation: ", r.escalation.required, "-", r.escalation.team);
    console.log("Suspicious: ", r.suspicious_content);
  } catch (e) {
    console.log("Could not read this file (empty or invalid JSON)");
  }
}