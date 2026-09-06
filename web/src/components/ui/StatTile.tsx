import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: "positive" | "negative";
}) {
  const toneClass = tone === "positive" ? " stat-tile__value--positive" : tone === "negative" ? " stat-tile__value--negative" : "";
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className={`stat-tile__value${toneClass}`}>{value}</span>
    </div>
  );
}
