import { Button, Input, Select, Slider, Switch } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
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
        {entries.map(([key, control]) => {
          if (control.type === 'select') {
            return (
              <Field key={key}>
                <Label className="text-xs font-medium text-text-secondary">{key}</Label>
                <Select
                  value={values[key] as string}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
                >
                  {control.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }

          if (control.type === 'text') {
            return (
              <Field key={key}>
                <Label className="text-xs font-medium text-text-secondary">{key}</Label>
                <Input
                  type="text"
                  value={values[key] as string}
                  placeholder={control.placeholder}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
                />
              </Field>
            );
          }

          return (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={`prop-${key}`} className="text-xs font-medium text-text-secondary">
                {key}
              </label>
              {control.type === 'boolean' && (
                <Switch
                  id={`prop-${key}`}
                  checked={values[key] as boolean}
                  onChange={(checked) => onChange(key, checked)}
                />
              )}
              {(control.type === 'number' || control.type === 'range') && (
                <div className="flex items-center gap-2">
                  <Slider
                    value={values[key] as number}
                    min={control.min}
                    max={control.max}
                    step={control.step ?? 1}
                    onChange={(next) => onChange(key, next)}
                    className="flex-1"
                  />
                  <span className="min-w-[2rem] text-right text-xs tabular-nums text-text-muted">
                    {values[key] as number}
                  </span>
                </div>
              )}
              {control.type === 'color' && (
                <div className="flex flex-wrap gap-1">
                  {control.options.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      size="icon"
                      appearance="ghost"
                      variant="neutral"
                      title={color}
                      onClick={() => onChange(key, color)}
                      className={`size-5 min-h-0 rounded-full border-2 p-0 transition-transform hover:scale-110 ${
                        values[key] === color ? 'border-accent scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
