# FinanceOS — Invoice Exception Triage

A working proof-of-concept for **Process 1** of the FinanceOS assessment: AP invoices are matched
against a PO register, discrepancies are detected deterministically, and Claude generates a
plain-English approve/escalate/reject recommendation with a one-sentence rationale — always
reviewable and overridable by a human, with every AI decision and override logged.

Processes 2 (Budget Variance Narrative) and 3 (Vendor Risk Screener) are not built yet; see
"What's not built yet" below.

## Stack

- **Backend:** Node.js + TypeScript + Express, SQLite via Prisma
- **Frontend:** React + TypeScript + Vite
- **LLM:** Anthropic Claude (`@anthropic-ai/sdk`), prompt in [`/prompts/invoice_triage.md`](prompts/invoice_triage.md)
- **Auth:** JWT session, one seeded demo user

## Setup

Prerequisites: Node.js 20+ and an Anthropic API key.

```bash
# 1. Backend
cd server
npm install
cp ../.env.example .env   # then edit .env and set ANTHROPIC_API_KEY
npx prisma migrate dev    # creates dev.db and applies schema
npm run seed              # loads the PO register, vendor list, and demo user
npm run dev                # http://localhost:4000

# 2. Frontend (separate terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

Log in at `http://localhost:5173` with the seeded demo user:

- **Email:** `analyst@financeos.demo`
- **Password:** `demo1234`

On the "New Invoice" page, click **"Load sample batch (15 invoices)"** to load the Appendix A
exception batch and see AI triage run against every case live.

## Environment variables

See [`.env.example`](.env.example) at the repo root — copy it to `server/.env`.

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 4000) |
| `DATABASE_URL` | SQLite connection string, e.g. `file:./dev.db` |
| `JWT_SECRET` | Signs login session tokens — change from the placeholder |
| `ANTHROPIC_API_KEY` | Required for real AI triage. Without it (or if the call fails), the app falls back to a rule-based recommendation and flags it in the UI — it does not crash. |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-4-5` |

## How triage works

1. **Deterministic matching** (`server/src/services/matching.ts`) looks up the PO register and
   flags: missing PO reference, PO not found, unrecognised vendor, closed PO, duplicate
   submission, and over/under the approved amount. This is the source of truth for facts — the
   LLM is never asked to compute amounts or decide whether a PO exists.
2. **LLM triage** (`server/src/services/llmTriage.ts`) sends the invoice, matched PO, and
   discrepancy flags to Claude and asks for a structured JSON recommendation + one-sentence
   rationale. The prompt is externalized in `/prompts/invoice_triage.md`.
3. If the Claude call times out, errors, or returns something that fails schema validation, the
   app retries once, then falls back to the rule-based suggestion from step 1 — the invoice is
   still triaged, `ai_fallback` is set, and the UI shows a banner rather than failing silently.
4. Every AI recommendation and every human decision (confirm or override) is written to
   `audit_log`, which powers the override-rate metric on the dashboard.

## Repo layout

```
prompts/invoice_triage.md   # system + user prompt template
server/                     # Express API, Prisma schema + seed
client/                     # React frontend
```

## What's not built yet

- **PDF invoice upload/OCR.** The spec allows JSON upload or manual entry as an alternative; the
  UI supports manual entry, pasting/uploading structured JSON, and a one-click sample batch
  loader. PDF parsing would need OCR/extraction and is deferred rather than attempted partially.
- **Processes 2 and 3** (Budget Variance Narrative, Vendor Risk Screener) and the DB tables/UI
  they need (`budget_actuals`, the full `vendors` profile with ABN/bank account/risk tier).
- **Architecture diagram and `docs/design-decisions.md`** — will be produced once more of the
  app exists so the diagram reflects what's actually built.
