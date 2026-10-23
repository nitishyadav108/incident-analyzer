# AI Incident Analyzer

A small web tool that helps an L1/L2 Technology Operations engineer triage application incidents. The engineer pastes or uploads logs, and the tool returns a structured report: what failed, the likely cause (with evidence kept separate from assumptions), severity, what to check first, who to escalate to, and a short message to share with the team.

**Live demo:** [FILL IN: Render link]
**Note:** the demo runs on a free host that sleeps when idle, so the first load can take up to a minute.

## The problem

During an incident, an engineer has to read hundreds of noisy log lines to answer a few questions: what is broken, how serious is it, what do I check first, and do I escalate? This tool answers those questions in seconds and shows its evidence, so the engineer can verify it instead of just trusting it.

## How it works

```
Log text
  |
  v
1. Number every line (L001, L002, ...)
2. Count errors and warnings in plain code (no AI)
3. Send the counts + numbered log + instructions (prompt) to an LLM
4. Receive a JSON report and check that it is valid JSON
5. Replace the error counts with the code-calculated ones
6. Show the report; evidence references jump to the exact log line
```

### Design decision: code counts, AI explains

In my first version the LLM also counted the errors, and it got them wrong. For example, it reported 4 gateway timeouts when the log has 3, and 6 pool-exhaustion errors while listing only 5 lines as evidence. LLMs are unreliable at counting, so I moved all counting into code (`countErrors.js`). It groups similar errors by replacing numbers and IDs with `#`, then counts them and records first/last time and line numbers. The AI receives these counts as facts and is told not to count. The final report always uses the code's numbers.

### Prompt design (`prompt.md`)

- **Evidence vs assumptions:** facts must cite a line number and a short quote. Anything inferred goes under "assumptions".
- **No overclaiming:** if one event happened before another, that is not treated as proof of cause. Causes are worded as possibilities and confidence is capped at "medium".
- **Honesty about gaps:** if the log is too vague, confidence is `insufficient_data` and the tool lists what extra information is needed.
- **Severity rubric:** Critical, High, Medium and Low are defined in the prompt so the levels are consistent.
- **No "users" without evidence:** logs that only show transaction IDs are not described as affecting a number of users.
- **Untrusted input:** log text is treated as data. Instructions found inside a log are ignored and reported as suspicious.
- **Structured output:** the model must return JSON, so each part of the report can be displayed separately. Temperature is set to 0 to make results more repeatable.

## Testing

I wrote five test logs (`sample_logs/` or the files in this repo) and defined the expected result for each before running them.

| # | Log | What it tests | Expected | Result |
|---|-----|---------------|----------|--------|
| 1 | Payment timeouts + DB pool exhaustion | The main use case | Critical or High | High, medium confidence, cause worded as "may be related" |
| 2 | Warnings only | No false alarm | Low, no escalation | Low, no escalation |
| 3 | Bad deploy hidden in unrelated noise | Ignoring noise, finding the real issue | High, links to release v2.14.0 | High, identifies `merchant_category_map` is null and the v2.14.0 release, ignores thumbnail errors |
| 4 | Vague logs | Not guessing | `insufficient_data` | `insufficient_data`, lists the missing information |
| 5 | Log line trying to give the AI instructions | Prompt injection | Flagged, not obeyed, not Critical | Low, injected line reported as suspicious and ignored |

### What testing taught me (iterations)

1. **The AI miscounted errors** → counting moved to code.
2. **The summary stated "pool exhaustion caused by long-running queries" as fact**, but the log only shows both events → added rule 7 (causes are assumptions) and a confidence cap.
3. **Log 4 returned `low` confidence instead of `insufficient_data`** → tightened rule 3 and added a `missing_information` field.
4. **Log 1 dropped from Critical to High** after I told the AI not to say "users" (rule 8), because my Critical definition said "many users". Two of my own rules pulled against each other. [FILL IN: either "I left this as is and consider High acceptable" or "I changed the Critical definition to 'failing repeatedly or across many transactions' and re-tested"]

## Security and safety

- The API key is stored in an environment variable. It is not in the code, not in Git, and never sent to the browser. The browser only talks to my server, and only the server calls the AI.
- Log content is untrusted. It is shown with `textContent`, never as HTML, so a malicious log cannot run code in the page.
- The server rejects empty input and logs over 100,000 characters.
- Each visitor is limited to 10 analyses per minute, so the public demo cannot drain the API quota.
- This is a demo: do not paste real production logs into it. [FILL IN: mention the free AI tier's data policy if you want]

## Limitations

- The AI's cause, severity and steps are suggestions. They can be wrong and must be checked against the log.
- I tested on five small, hand-written logs. Real logs are bigger and messier.
- Results are more repeatable at temperature 0 but are not guaranteed to be identical every time.
- The parser expects lines like `2026-10-20 14:02:11 ERROR service message`. Other log formats will not be grouped by the code, and the AI falls back to reading the raw lines.
- Passing one prompt-injection test does not prove the tool is immune to injection.
- Very large logs are rejected rather than split into chunks.

## What I would do next

- Check automatically that every line number and quote the AI cites really exists in the log.
- Support more log formats (JSON logs, stack traces spanning several lines).
- Handle large logs by chunking and summarising.
- Add a larger test set and a score for how often severity matches the expected level.
- Add authentication to the public demo.

## Tech stack

Node.js, Express, plain HTML/CSS/JavaScript, Google Gemini API (free tier, model `gemini-3.5-flash-lite`), hosted on Render.

## Project structure

```
server.js        Web server, rate limit, /analyze endpoint
analyze.js       Numbers lines, calls the AI, validates the JSON
countErrors.js   Groups and counts errors and warnings in code
prompt.md        The instructions given to the AI
public/index.html  The web page
sample_logs/     Test logs (or the .log files in the repo root)
```

## Run it locally

```
npm install
```

Create a `.env` file containing:

```
GEMINI_API_KEY=your-key-here
```

Then:

```
node server.js
```

Open http://localhost:3000. To analyze a file from the terminal: `node analyze.js 01_payment_timeouts_db_failures.log`

## Use of AI tools

[FILL IN honestly. For example: "I used Claude as a learning and coding assistant for the starter prompt, sample logs and code scaffolding. I reviewed and tested all of it, ran the five test cases myself, and made the design decisions described above (moving counting into code, the prompt rules, the rate limit)."]
