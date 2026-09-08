import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, AuditEntry, Invoice, PurchaseOrder } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/LoadingState";

const DECISIONS: Array<{ value: "approve" | "escalate" | "reject"; label: string; className: string }> = [
  { value: "approve", label: "Approve invoice", className: "btn-approve" },
  { value: "escalate", label: "Escalate for review", className: "btn-escalate" },
  { value: "reject", label: "Reject invoice", className: "btn-reject" },
];

function describeAuditAction(entry: AuditEntry): string {
  switch (entry.action) {
    case "ai_triage":
      return "AI generated a triage recommendation";
    case "ai_triage_retry":
      return "AI re-ran the triage recommendation";
    case "human_confirm":
      return "Analyst confirmed the AI recommendation";
    case "human_override":
      return "Analyst overrode the AI recommendation";
    default:
      return entry.action;
  }
}

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = Number(id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [inv, auditEntries, pos] = await Promise.all([
      api.getInvoice(invoiceId),
      api.getInvoiceAudit(invoiceId),
      api.listPurchaseOrders(),
    ]);
    setInvoice(inv);
    setAudit(auditEntries);
    setPurchaseOrder(pos.find((po) => po.poNumber === inv.poNumber) || null);
  }, [invoiceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoice"));
  }, [load]);

  const handleDecision = async (decision: "approve" | "escalate" | "reject") => {
    setWorking(true);
    setError(null);
    try {
      await api.overrideInvoice(invoiceId, decision);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setWorking(false);
    }
  };

  const handleRetry = async () => {
    setWorking(true);
    setError(null);
    try {
      await api.retryAi(invoiceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry AI triage");
    } finally {
      setWorking(false);
    }
  };

  if (!invoice) {
    return (
      <div className="page">
        {error ? <div className="banner banner-error">{error}</div> : <LoadingState label="Loading invoice..." />}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn" onClick={() => navigate("/invoices")} style={{ marginBottom: 12 }}>
            ← Back to invoices
          </button>
          <h1>{invoice.vendorName}</h1>
          <p>
            Invoice #{invoice.id} · Submitted {new Date(invoice.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge value={invoice.status} />
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {invoice.aiFallback && (
        <div className="banner banner-warning">
          AI was unavailable when this invoice was triaged — the recommendation below is a rule-based fallback.
          <button className="btn" style={{ marginLeft: 12 }} onClick={handleRetry} disabled={working}>
            Retry AI triage
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Invoice vs. purchase order</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Invoice</th>
              <th>Matched PO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PO reference</td>
              <td>{invoice.poNumber || "Not provided"}</td>
              <td>{purchaseOrder?.poNumber || "—"}</td>
            </tr>
            <tr>
              <td>Amount</td>
              <td>${invoice.amount.toLocaleString()}</td>
              <td>{purchaseOrder ? `$${purchaseOrder.approvedAmount.toLocaleString()}` : "—"}</td>
            </tr>
            <tr>
              <td>Cost centre</td>
              <td>—</td>
              <td>{purchaseOrder?.costCentre || "—"}</td>
            </tr>
            <tr>
              <td>PO status</td>
              <td>—</td>
              <td>{purchaseOrder?.status || "—"}</td>
            </tr>
          </tbody>
        </table>

        {invoice.exceptionFlags.length > 0 ? (
          <>
            <h4>Discrepancies detected</h4>
            <ul className="flags-list">
              {invoice.exceptionFlags.map((flag, i) => (
                <li key={i}>{flag.message}</li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>No discrepancies detected — invoice matches the PO.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>AI triage recommendation</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge value={invoice.aiRecommendation} />
        </div>
        <div className="rationale-box">{invoice.aiRationale}</div>

        <h4>Your decision</h4>
        {invoice.humanOverride ? (
          <p>
            Recorded as <StatusBadge value={invoice.humanOverride} /> on{" "}
            {invoice.resolvedAt && new Date(invoice.resolvedAt).toLocaleString()}. You can change it below.
          </p>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>
            Not yet reviewed. The AI's recommendation is pre-highlighted — choose to accept it or override.
          </p>
        )}
        <div className="decision-row">
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              className={`btn ${d.className}`}
              style={{
                outline: invoice.aiRecommendation === d.value ? "2px solid var(--color-primary)" : undefined,
              }}
              onClick={() => handleDecision(d.value)}
              disabled={working}
            >
              {d.label}
              {invoice.aiRecommendation === d.value && " (AI suggested)"}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Audit trail</h3>
        {audit.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No activity recorded yet.</p>
        ) : (
          <ul className="flags-list">
            {audit.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.timestamp).toLocaleString()} — {describeAuditAction(entry)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
