# Design decisions & trade-offs

## 1. Deterministic matching runs before the LLM, not instead of it

Every discrepancy (missing PO, PO not found, closed PO, duplicate, over/under amount) is detected
in `matching.ts` by querying the PO register directly — not by asking the LLM to compute or recall
it. The LLM only reasons over facts it's handed and produces the recommendation + rationale. This
was the right trade-off for a Finance workflow: an LLM that occasionally miscalculates an amount
or hallucinates a PO number is a controls failure, not a UX nit. The cost is that the "AI" layer
looks thinner than a model that does everything end-to-end — but it's also why the rule-based
fallback (below) can reuse the same logic and produce a trustworthy answer even when Claude is
unavailable.

## 2. The rule-based fallback is the same logic, not a separate "if AI is down" branch

`matching.ts` always produces a `suggestedRecommendation` alongside its flags. When the Claude
call times out, errors, or returns something that fails schema validation, that suggestion becomes
the stored recommendation, `ai_fallback` is set, and the UI shows a banner rather than a blank
screen or a crash. The trade-off is a slightly less "smart"-sounding rationale during an outage
("AI unavailable — showing rule-based suggestion") — acceptable, because it's honest about what
generated the answer, which matters more in AP than sounding polished.

## 3. SQLite via Prisma instead of Postgres

The spec allows either. SQLite means no separate DB server to install or configure for a local
demo, while migrations, a real schema, and Prisma's query API stay identical to what a Postgres
setup would look like — so moving to Postgres later is a one-line `datasource` change, not a
rewrite. The trade-off is that SQLite won't reflect production concurrency behavior, which is fine
for a single-analyst demo but would need revisiting before real deployment.

## 4. `po_number` on `invoices` is a plain string, not a foreign key

Roughly a third of the seed exception cases are invoices with a missing or nonexistent PO
reference — that's the point of the process, not bad data. A foreign key constraint would make
those rows either impossible to insert or require a nullable-FK workaround that adds complexity
for no real benefit, since the PO lookup already happens explicitly in `matching.ts`. The
trade-off is that referential integrity between `invoices.po_number` and `purchase_orders` is
enforced in application code rather than the database — acceptable here because that code path is
exercised on every single invoice creation.

## 5. Scope cut: JSON upload + manual entry, not PDF/OCR

The spec explicitly allows PDF *or* structured JSON/manual entry. Building PDF parsing would have
spent most of the available time on text extraction rather than the matching and triage logic that
the assessment is actually evaluating. JSON upload, manual entry, and a one-click sample-batch
loader cover the same demo scenarios; PDF/OCR is documented in the README as a deferred increment
rather than attempted partially.
