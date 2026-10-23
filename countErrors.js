const fs = require("fs");

function summarizeLog(text) {
  const lines = text.split("\n").filter(l => l.trim() !== "");
  const groups = {};

  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\w+)\s+(\S+)\s+(.*)$/);
    if (!m) return;
    const [, time, level, service, message] = m;
    if (level !== "ERROR" && level !== "WARN") return;

    const key = `${level} ${service} ${message.replace(/\d+/g, "#")}`;
    if (!groups[key]) {
      groups[key] = { pattern: key, count: 0, first_seen: time, last_seen: time, lines: [] };
    }
    groups[key].count++;
    groups[key].last_seen = time;
    groups[key].lines.push(i + 1);
  });

  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// Errors and warnings per time bucket, for the timeline chart.
// Buckets are 1 minute, widened so there are never more than 60 bars.
function buildTimeline(text) {
  const lines = text.split("\n").filter(l => l.trim() !== "");
  const entries = [];

  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}\s+(\w+)/);
    if (!m) return;
    const minute = Date.parse(`${m[1]}T${m[2]}:00Z`) / 60000; // treat as UTC so no timezone shift
    entries.push({ minute, level: m[3], line: i + 1 });
  });
  if (!entries.length) return { bucket_minutes: 1, buckets: [] };

  const first = Math.min(...entries.map(e => e.minute));
  const last = Math.max(...entries.map(e => e.minute));
  const size = Math.max(1, Math.ceil((last - first + 1) / 60));

  const buckets = [];
  for (let t = first; t <= last; t += size) {
    buckets.push({ time: new Date(t * 60000).toISOString().slice(11, 16), errors: 0, warnings: 0, first_line: null });
  }
  entries.forEach(e => {
    const b = buckets[Math.floor((e.minute - first) / size)];
    if (b.first_line === null) b.first_line = e.line;
    if (e.level === "ERROR") b.errors++;
    if (e.level === "WARN") b.warnings++;
  });
  return { bucket_minutes: size, buckets };
}

module.exports = { summarizeLog, buildTimeline };

if (require.main === module) {
  const text = fs.readFileSync(process.argv[2], "utf8");
  const result = summarizeLog(text);
  console.table(result.map(g => ({ ...g, lines: g.lines.join(",") })));
}