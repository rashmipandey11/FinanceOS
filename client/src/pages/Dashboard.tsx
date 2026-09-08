import { useEffect, useState } from "react";
import { api, DashboardSummary } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { MetricTile } from "../components/MetricTile";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "<1 min";
  return `${value.toFixed(1)} min`;
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Exception volume, how often analysts override the AI, and how fast invoices get resolved.</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {!summary ? (
        <LoadingState label="Loading metrics..." />
      ) : summary.totalInvoices === 0 ? (
        <div className="card">
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            No invoices yet — metrics will appear once invoices have been triaged.
          </p>
        </div>
      ) : (
        <>
          <div className="metrics-row">
            <MetricTile value={String(summary.totalInvoices)} label="Total invoices" />
            <MetricTile
              value={`${summary.exceptionCount} (${formatPercent(summary.exceptionRate)})`}
              label="Exception volume"
            />
            <MetricTile
              value={summary.resolvedCount > 0 ? formatPercent(summary.overrideRate) : "—"}
              label="AI vs human override rate"
            />
            <MetricTile value={formatMinutes(summary.avgResolutionMinutes)} label="Avg. resolution time" />
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Status breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                  <tr key={status}>
                    <td style={{ textTransform: "capitalize" }}>{status}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
