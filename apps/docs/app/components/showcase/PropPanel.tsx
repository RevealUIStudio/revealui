import type { PropControls } from './types.js';

interface PropPanelProps {
  controls: PropControls;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function PropPanel({ controls, values, onChange }: PropPanelProps) {
  const entries = Object.entries(controls);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
        Props
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, control]) => (
          <div key={key} className="flex flex-col gap-1">
            <label htmlFor={`prop-${key}`} className="text-xs font-medium text-text-secondary">
              {key}
            </label>
            {control.type === 'select' && (
              <select
                id={`prop-${key}`}
                value={values[key] as string}
                onChange={(e) => onChange(key, e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
              >
                {control.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {control.type === 'boolean' && (
              <button
                type="button"
                id={`prop-${key}`}
                role="switch"
                aria-checked={values[key] as boolean}
                onClick={() => onChange(key, !(values[key] as boolean))}
                className={`relative h-6 w-10 rounded-full transition-colors ${
                  values[key] ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                    values[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
            {control.type === 'text' && (
              <input
                id={`prop-${key}`}
                type="text"
                value={values[key] as string}
                placeholder={control.placeholder}
                onChange={(e) => onChange(key, e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
              />
            )}
            {(control.type === 'number' || control.type === 'range') && (
              <div className="flex items-center gap-2">
                <input
                  id={`prop-${key}`}
                  type="range"
                  value={values[key] as number}
                  min={control.min}
                  max={control.max}
                  step={control.step ?? 1}
                  onChange={(e) => onChange(key, Number(e.target.value))}
                  className="h-1.5 flex-1 appearance-none rounded-full bg-border accent-accent"
                />
                <span className="min-w-[2rem] text-right text-xs tabular-nums text-text-muted">
                  {values[key] as number}
                </span>
              </div>
            )}
            {control.type === 'color' && (
              <div className="flex flex-wrap gap-1">
                {control.options.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => onChange(key, color)}
                    className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${
                      values[key] === color ? 'border-accent scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
