# Design decisions & trade-offs

## 1. Deterministic matching runs before the LLM, not instead of it

Core invoice checks — such as missing or invalid POs, closed POs, duplicates, and amount differences — are handled through predefined rules against the PO register. Claude receives these results and provides a recommended action and rationale.
This keeps factual checks deterministic, which is important for a Finance workflow where incorrect calculations or PO references could create control issues.This is intentional as it reduces the risks of hallucinations.

Trade-off: AI has a more focused role rather than managing the process end-to-end, but the results are more reliable and the workflow can continue if Claude is unavailable.

## 2. The rule-based fallback is the same logic, not a separate "if AI is down" branch

Every invoice receives a rule-based recommendation during matching. Claude can enhance this with additional reasoning, but if the AI call fails, times out, or returns an invalid response, the rule-based recommendation is used automatically.
The user is clearly notified when this happens rather than seeing an error or blank screen.

Trade-off: The fallback explanation may be simpler, but maintaining continuity and being transparent about how the recommendation was generated are more important.

## 3. SQLite via Prisma instead of Postgres

SQLite was chosen because it allows the app to run locally without requiring a separate database setup instead of Postgres to save time and efforts, perhaps can move to Postgres relatively later for deployment or large scale usage.

Trade-off: SQLite does not replicate production-level concurrency and scale. It works for the current prototype but should be revisited before broader deployment.

## 4. `po_number` on `invoices` is a plain string, not a foreign key

Invoice PO numbers are not restricted to values already present in the PO register. This is intentional because identifying missing or invalid PO references is one of the exceptions the app is designed to detect.
The application therefore validates the PO during the matching process rather than preventing the invoice from being entered.

Trade-off: PO validity is enforced through application logic rather than directly by the database, providing the flexibility needed to process exception cases.

## 5. Scope cut: JSON upload + manual entry, not PDF/OCR

For the first version, I prioritised JSON upload and manual entry rather than PDF/OCR processing. This allowed development time to focus on the core objective: invoice matching, exception identification, and triage.

The complete workflow can still be demonstrated through structured uploads, manual entry, and sample data.

Trade-off: Direct PDF invoice uploads are not yet supported. PDF/OCR would be a logical next enhancement rather than partially implementing it in the initial version.
