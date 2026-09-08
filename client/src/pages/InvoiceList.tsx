import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Invoice } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";

export function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listInvoices()
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoices"));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Every invoice triaged so far, with the AI recommendation and current status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/invoices/new")}>
          + New invoice
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {invoices === null ? (
          <LoadingState label="Loading invoices..." />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description='Get started by entering one manually or clicking "Load sample batch" on the New Invoice page.'
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>PO reference</th>
                <th>Amount</th>
                <th>AI recommendation</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td>{inv.vendorName}</td>
                  <td>{inv.poNumber || "—"}</td>
                  <td>${inv.amount.toLocaleString()}</td>
                  <td><StatusBadge value={inv.aiRecommendation} /></td>
                  <td><StatusBadge value={inv.status} /></td>
                  <td>{new Date(inv.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
