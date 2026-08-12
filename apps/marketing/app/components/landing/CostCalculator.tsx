import { Slider } from '@revealui/presentation';
import { useState } from 'react';
import { PRICING_COST_CALCULATOR as C } from '../../content/pricing';

/**
 * Interactive cost calculator. Replaces the former static HOME_PROBLEM cost row.
 * The output is ALWAYS one of the sanctioned 00-truth-source §3 brackets (entry /
 * growth / scale); the inputs only move you between sourced ranges, so the figure
 * is never fabricated outside the §3 band. No vendor names. CSR-only (Vite SPA).
 *
 * Tier-1: range inputs use @revealui/presentation Slider (GAP-398).
 */
function pickTier(products: number, vendors: number, mrr: number) {
  const score = (products >= 3 ? 1 : 0) + (vendors >= 5 ? 1 : 0) + (mrr >= 20000 ? 1 : 0);
  if (score >= 3) return C.tiers[2];
  if (score === 2) return C.tiers[1];
  return C.tiers[0];
}

function LabeledSlider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  // Pass `label` + `valueLabel` into Slider so the range input is associated
  // via htmlFor/id (axe "label" / WCAG 4.1.2). valueLabel keeps marketing
  // units (products+, $k) without decoupling the accessible name.
  return (
    <Slider
      label={label}
      valueLabel={display}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
    />
  );
}

export function CostCalculator() {
  const [products, setProducts] = useState<number>(C.inputs.products.default);
  const [vendors, setVendors] = useState<number>(C.inputs.vendors.default);
  const [mrr, setMrr] = useState<number>(C.inputs.mrr.default);

  const tier = pickTier(products, vendors, mrr);

  return (
    <section className="bg-background pb-24 sm:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {C.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {C.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-body">{C.body}</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6 rounded-2xl bg-card p-8 ring-1 ring-border">
            <LabeledSlider
              label={C.inputs.products.label}
              min={C.inputs.products.min}
              max={C.inputs.products.max}
              step={C.inputs.products.step}
              value={products}
              display={products >= C.inputs.products.max ? `${products}+` : String(products)}
              onChange={setProducts}
            />
            <LabeledSlider
              label={C.inputs.vendors.label}
              min={C.inputs.vendors.min}
              max={C.inputs.vendors.max}
              step={C.inputs.vendors.step}
              value={vendors}
              display={String(vendors)}
              onChange={setVendors}
            />
            <LabeledSlider
              label={C.inputs.mrr.label}
              min={C.inputs.mrr.min}
              max={C.inputs.mrr.max}
              step={C.inputs.mrr.step}
              value={mrr}
              display={
                mrr >= C.inputs.mrr.max
                  ? `$${(mrr / 1000).toFixed(0)}k+`
                  : `$${(mrr / 1000).toFixed(0)}k`
              }
              onChange={setMrr}
            />
          </div>

          <div className="flex flex-col justify-center gap-6 rounded-2xl bg-secondary p-8 ring-1 ring-border">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {C.rentedLabel}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{tier.range}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tier.note}</p>
            </div>
            <div className="border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {C.revealui.label}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-primary">
                {C.revealui.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{C.revealui.sub}</p>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          {C.footnote}
        </p>
      </div>
    </section>
  );
}
