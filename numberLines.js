const fs = require("fs");

const text = fs.readFileSync("01_payment_timeouts_db_failures.log", "utf8");
const lines = text.split("\n").filter(line => line.trim() !== "");
const numbered = lines.map((line, i) => `L${String(i + 1).padStart(3, "0")} | ${line}`);

console.log(numbered.join("\n"));