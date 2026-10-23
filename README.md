# 🔎 AI Incident Analyzer

Paste application logs and get a structured incident report: severity, likely cause with evidence, what to check first, and who to escalate to.

**Live demo:** https://incident-analyzer.onrender.com

![Incident Analyzer home screen](project_screenshots/Screenshot%202026-10-23%20at%203.09.13%20PM.png)

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

![Report with severity, summary and likely cause](project_screenshots/Screenshot%202026-10-23%20at%203.09.40%20PM.png)

---

## 3. From JSON to screen

```mermaid
flowchart LR
    subgraph JSON["AI JSON + code counts"]
        s1["severity"]
        s3["summary"]
        s4["likely_cause<br/>confidence · evidence · assumptions"]
        s5["missing_information"]
        s6["key_errors (from code)"]
        s7["troubleshooting_steps"]
        s8["escalation"]
        s9["incident_summary"]
    end
    subgraph UI["Report panel"]
        u1["Coloured severity banner"]
        u3["Summary"]
        u4["Likely cause + clickable L### evidence"]
        u5["Information needed to go further"]
        u6["Errors and warnings table"]
        u7["What to check first"]
        u8["Escalate · Team · When"]
        u9["Copy-ready team message"]
    end
    s1-->u1
    s3-->u3
    s4-->u4
    s5-->u5
    s6-->u6
    s7-->u7
    s8-->u8
    s9-->u9
```

**Errors and warnings table:** counted by code, not by the AI:

![Errors and warnings table](project_screenshots/Screenshot%202026-10-23%20at%203.09.56%20PM.png)

**Troubleshooting steps, escalation and team message:**

![Steps, escalation and team message](project_screenshots/Screenshot%202026-10-23%20at%203.10.04%20PM.png)

---

## About the project

The tool is built for L1/L2 Technology Operations engineers. During an incident they must read hundreds of noisy log lines to decide what is broken and whether to escalate. The tool gives an answer in seconds and cites the line number for each fact, so the engineer can check the answer instead of trusting it.

The key design choice is that **code counts and the AI explains**. LLMs are unreliable at counting, so all error counting is done by `countErrors.js`. The prompt keeps evidence separate from assumptions and treats log text as untrusted, so instructions hidden in a log are flagged, not followed.

**Tech stack:** Node.js, Express, plain HTML/CSS/JS, Google Gemini API, hosted on Render.

**Run locally:** `npm install`, add `GEMINI_API_KEY=your-key` to a `.env` file, run `node server.js`, then open http://localhost:3000.
