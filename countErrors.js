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

module.exports = { summarizeLog };

if (require.main === module) {
  const text = fs.readFileSync(process.argv[2], "utf8");
  const result = summarizeLog(text);
  console.table(result.map(g => ({ ...g, lines: g.lines.join(",") })));
}