export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  hint,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly hint?: string;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {suffix ? ` (${suffix})` : ""}
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
        />
      </label>
      {hint ? <span className="text-tertiary text-sm">{hint}</span> : null}
    </div>
  );
}
