export function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  valueLabel,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max: number;
  readonly step?: number;
  readonly valueLabel: string;
}) {
  return (
    <div className="field">
      <div className="row row--between">
        <label>{label}</label>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
}
