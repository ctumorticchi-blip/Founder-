export function ProgressBar({ fraction, tone = "default" }: { readonly fraction: number; readonly tone?: "default" | "danger" | "warning" }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const fillClass = tone === "danger" ? "progress-fill progress-fill--danger" : tone === "warning" ? "progress-fill progress-fill--warning" : "progress-fill";
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={fillClass} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
