import type { ShowcaseStory } from './types.js';

interface VariantGridProps {
  story: ShowcaseStory;
  values: Record<string, unknown>;
}

export function VariantGrid({ story, values }: VariantGridProps) {
  if (!story.variantGrid) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border p-12 text-sm text-text-muted">
        No variant grid defined for this component.
      </div>
    );
  }

  const axes = Object.entries(story.variantGrid);

  // Single axis — flat grid
  if (axes.length === 1) {
    const [propName, propValues] = axes[0]!;
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-surface px-4 py-2">
          <span className="text-xs font-medium text-text-muted">All {propName} variants</span>
        </div>
        <div
          className="flex flex-wrap items-center gap-4 p-6"
          style={{
            backgroundColor: 'oklch(0.13 0.004 228)',
            backgroundImage: 'radial-gradient(circle, oklch(0.5 0 0 / 0.06) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {propValues.map((val) => (
            <div key={val} className="flex flex-col items-center gap-2">
              {story.render({ ...values, [propName]: val })}
              <span className="text-[10px] font-mono text-text-muted">{val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Two axes — table grid (rows x columns)
  const [rowProp, rowValues] = axes[0]!;
  const [colProp, colValues] = axes[1]!;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="border-b border-border bg-surface px-4 py-2">
        <span className="text-xs font-medium text-text-muted">
          {rowProp} &times; {colProp}
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-border bg-surface p-2 text-left text-[10px] font-mono font-medium text-text-muted">
              {rowProp} \ {colProp}
            </th>
            {colValues.map((col) => (
              <th
                key={col}
                className="border-b border-border bg-surface p-2 text-center text-[10px] font-mono font-medium text-text-muted"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowValues.map((row) => (
            <tr key={row}>
              <td className="border-b border-border bg-surface p-2 text-[10px] font-mono text-text-muted">
                {row}
              </td>
              {colValues.map((col) => (
                <td
                  key={col}
                  className="border-b border-border p-3 text-center"
                  style={{ backgroundColor: 'oklch(0.13 0.004 228)' }}
                >
                  {story.render({
                    ...values,
                    [rowProp]: row,
                    [colProp]: col,
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
