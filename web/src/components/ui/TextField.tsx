import { useId } from "react";

export function TextField({
  label,
  value,
  onChange,
  hint,
  required = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: string;
  readonly required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="text-tertiary text-sm">{hint}</span> : null}
    </div>
  );
}
