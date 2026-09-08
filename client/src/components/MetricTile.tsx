export function MetricTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric-tile">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
