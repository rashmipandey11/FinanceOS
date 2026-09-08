import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import sampleInvoices from "../fixtures/sampleInvoices.json";

type Mode = "manual" | "json";

export function NewInvoice() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("manual");
  const [vendorName, setVendorName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const submitOne = async (input: { vendorName: string; poNumber: string | null; amount: number }) => {
    return api.createInvoice(input);
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!vendorName.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Vendor name and a positive amount are required.");
      return;
    }
    setBusyLabel("Analyzing invoice...");
    try {
      const invoice = await submitOne({
        vendorName: vendorName.trim(),
        poNumber: poNumber.trim() || null,
        amount: parsedAmount,
      });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit invoice");
      setBusyLabel(null);
    }
  };

  const handleJsonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(jsonText);
    } catch {
      setError("That doesn't look like valid JSON.");
      return;
    }
    const items = Array.isArray(payload) ? payload : [payload];
    await runBatch(items as { vendorName: string; poNumber?: string | null; amount: number }[]);
  };

  const runBatch = async (items: { vendorName: string; poNumber?: string | null; amount: number }[]) => {
    setError(null);
    let lastCreatedId: number | null = null;
    for (let i = 0; i < items.length; i++) {
      setBusyLabel(`Analyzing invoice ${i + 1} of ${items.length}...`);
      try {
        const invoice = await submitOne({
          vendorName: items[i].vendorName,
          poNumber: items[i].poNumber ?? null,
          amount: items[i].amount,
        });
        lastCreatedId = invoice.id;
      } catch (err) {
        setError(
          `Stopped at invoice ${i + 1} of ${items.length}: ${err instanceof Error ? err.message : "unknown error"}`
        );
        setBusyLabel(null);
        return;
      }
    }
    setBusyLabel(null);
    if (items.length === 1 && lastCreatedId) {
      navigate(`/invoices/${lastCreatedId}`);
    } else {
      navigate("/invoices");
    }
  };

  const loadSampleBatch = () => {
    const items = (sampleInvoices as { vendorName: string; poNumber: string | null; amount: number }[]).map(
      ({ vendorName, poNumber, amount }) => ({ vendorName, poNumber, amount })
    );
    void runBatch(items);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>New invoice</h1>
          <p>Enter an invoice manually, paste structured JSON, or load the sample exception batch.</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {busyLabel && <div className="banner banner-warning">{busyLabel}</div>}

      <div className="tabs">
        <button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}>
          Manual entry
        </button>
        <button className={mode === "json" ? "active" : ""} onClick={() => setMode("json")}>
          Structured JSON
        </button>
        <button onClick={loadSampleBatch} disabled={!!busyLabel}>
          Load sample batch (15 invoices)
        </button>
      </div>

      <div className="card">
        {mode === "manual" ? (
          <form onSubmit={handleManualSubmit}>
            <div className="form-field">
              <label htmlFor="vendorName">Vendor name</label>
              <input
                id="vendorName"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Acme Consulting Ltd"
              />
            </div>
            <div className="form-field">
              <label htmlFor="poNumber">PO number (leave blank if none)</label>
              <input
                id="poNumber"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2024-001"
              />
            </div>
            <div className="form-field">
              <label htmlFor="amount">Invoice amount ($)</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 45000"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!!busyLabel}>
              Submit for AI triage
            </button>
          </form>
        ) : (
          <form onSubmit={handleJsonSubmit}>
            <div className="form-field">
              <label htmlFor="json">Invoice JSON (single object or array)</label>
              <textarea
                id="json"
                rows={10}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"vendorName": "Acme Consulting Ltd", "poNumber": "PO-2024-001", "amount": 45000}'
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!!busyLabel}>
              Submit for AI triage
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
