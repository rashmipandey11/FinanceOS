const LABELS: Record<string, string> = {
  approve: "Approve",
  escalate: "Escalate",
  reject: "Reject",
  pending: "Pending review",
};

export function StatusBadge({ value }: { value: string | null }) {
  const key = value || "pending";
  return <span className={`badge badge-${key}`}>{LABELS[key] || key}</span>;
}
