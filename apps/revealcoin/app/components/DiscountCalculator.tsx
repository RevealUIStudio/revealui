import { useState } from 'react';
import { RVUI_DISCOUNT_RATES } from '@/lib/constants';

const services = Object.values(RVUI_DISCOUNT_RATES);

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function DiscountCalculator() {
  const [spends, setSpends] = useState<Record<string, string>>({});

  const rows = services.map((rate) => {
    const raw = spends[rate.service] ?? '';
    const amount = Number.parseFloat(raw) || 0;
    const savings = amount * (rate.discountPercent / 100);
    const discounted = amount - savings;
    return { ...rate, raw, amount, savings, discounted };
  });

  const totalSpend = rows.reduce((sum, r) => sum + r.amount, 0);
  const totalSavings = rows.reduce((sum, r) => sum + r.savings, 0);
  const hasInput = totalSpend > 0;

  return (
    <div>
      {/* Service rows */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.service} className="rounded-xl bg-gray-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Service info */}
              <div className="flex items-center gap-3 sm:min-w-0 sm:flex-1">
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {row.discountPercent}% off
                </span>
                <span className="text-sm font-medium text-gray-950">{row.service}</span>
              </div>

              {/* Input + result */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={row.raw}
                    onChange={(e) =>
                      setSpends((prev) => ({
                        ...prev,
                        [row.service]: e.target.value,
                      }))
                    }
                    className="w-28 rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-right text-sm font-mono text-gray-950 placeholder:text-gray-300 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    aria-label={`Monthly spend on ${row.service}`}
                  />
                </div>
                {row.amount > 0 && (
                  <span className="text-sm font-mono text-emerald-600 whitespace-nowrap">
                    save {formatUsd(row.savings)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {hasInput && (
        <div className="mt-6 rounded-xl bg-violet-50 p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Fiat Cost</p>
              <p className="text-sm font-semibold font-mono text-gray-700">
                {formatUsd(totalSpend)}
              </p>
            </div>
            <div>
              <p className="text-xs text-violet-500">With RVC</p>
              <p className="text-sm font-semibold font-mono text-violet-700">
                {formatUsd(totalSpend - totalSavings)}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-500">You Save</p>
              <p className="text-sm font-semibold font-mono text-emerald-700">
                {formatUsd(totalSavings)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasInput && (
        <p className="mt-4 text-center text-sm text-gray-400">
          Enter your monthly spend above to see how much you save with RVC.
        </p>
      )}
    </div>
  );
}
