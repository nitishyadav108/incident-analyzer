# 🔎 AI Incident Analyzer

Paste application logs and get a structured incident report: severity, likely cause with evidence, what to check first, and who to escalate to.

**Live demo:** https://incident-analyzer.onrender.com

---

## 1. The analysis pipeline

```mermaid
flowchart TD
    IN[/"Raw log text"/] --> V{"Empty or<br/>> 100k chars?"}
    V -- yes --> ERR["❌ Reject with a clear error"]
    V -- no --> N["1️⃣ Number every line<br/>L001, L002, ..."]
    N --> C["2️⃣ Count errors & warnings in code<br/>countErrors.js"]
    C --> M["3️⃣ Build the message<br/>statistics + numbered log"]
    M --> LLM["4️⃣ Gemini with prompt.md<br/>temperature 0, JSON only"]
    LLM --> J{"5️⃣ Valid JSON?"}
    J -- no --> ERR2["❌ 'The AI did not return valid JSON'"]
    J -- yes --> O["6️⃣ Replace key_errors<br/>with the code's numbers"]
    O --> OUT[/"📄 Final report → browser"/]

    style C fill:#E3F4EA,stroke:#1B7A4B
    style O fill:#E3F4EA,stroke:#1B7A4B
    style LLM fill:#E6EFF9,stroke:#1F5FA8
```

🟩 green = plain code (exact), 🟦 blue = AI

---

## 2. What happens when you click Analyze

```mermaid
sequenceDiagram
    autonumber
    actor E as Engineer
    participant B as Browser
    participant S as server.js
    participant A as analyze.js
    participant C as countErrors.js
    participant G as Gemini API

    E->>B: Paste / upload log, click Analyze
    B->>S: POST /analyze { log }
    S->>S: Rate limit check (10/min per IP)
    S->>A: analyzeLog(text)
    A->>A: Validate input, number lines
    A->>C: summarizeLog(text)
    C-->>A: Exact error / warning counts
    A->>G: system prompt + stats + numbered log
    G-->>A: JSON report
    A->>A: Parse JSON, overwrite counts with code values
    A-->>S: Final report
    S-->>B: 200 JSON
    B->>B: Render report, colour and mark cited log lines
```

The log is shown with line numbers. Red lines are errors, amber lines are warnings, and a blue edge marks the lines the report uses as evidence:

![Report with severity, summary and likely cause](project_screenshots/02_report.png)

**Errors and warnings table:** counted by code, not by the AI:

![Errors and warnings table](project_screenshots/03_errors_table.png)

**Recommended solutions:** immediate and long-term fixes, each with a risk level and links to the log lines it addresses, followed by escalation and a ready-to-share team message:

![Recommended solutions, escalation and team message](project_screenshots/04_escalation.png)

---

## About the project

The tool is built for L1/L2 Technology Operations engineers. During an incident they must read hundreds of noisy log lines to decide what is broken and whether to escalate. The tool gives an answer in seconds and cites the line number for each fact, so the engineer can check the answer instead of trusting it.

The key design choice is that **code counts and the AI explains**. LLMs are unreliable at counting, so all error counting is done by `countErrors.js`. The prompt keeps evidence separate from assumptions and treats log text as untrusted, so instructions hidden in a log are flagged, not followed.

**Tech stack:** Node.js, Express, plain HTML/CSS/JS, Google Gemini API, hosted on Render.

**Run locally:** `npm install`, add `GEMINI_API_KEY=your-key` to a `.env` file, run `node server.js`, then open http://localhost:3000.
