import { ProgressBar } from "./ProgressBar";

export function SkillBar({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <span className="text-sm">{label}</span>
        <span className="text-sm text-secondary">{Math.round(value)}/100</span>
      </div>
      <ProgressBar fraction={value / 100} />
    </div>
  );
}
