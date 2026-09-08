export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, color: "#1a1f29" }}>{title}</p>
      {description && <p>{description}</p>}
    </div>
  );
}
