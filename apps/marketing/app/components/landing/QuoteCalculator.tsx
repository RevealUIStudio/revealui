import {
  Button,
  MarketingSection,
  Radio,
  RadioField,
  RadioGroup,
  SectionHeader,
} from '@revealui/presentation';
import { useMemo, useState } from 'react';
import {
  QUOTE_CALCULATOR as C,
  DEFAULT_QUOTE_ANSWERS,
  type PlaceCount,
  resolveQuote,
  type WhatWork,
  type WhoLive,
} from '../../content/quote-calculator';

function QuestionGroup<Id extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: Id;
  options: readonly { id: Id; label: string }[];
  onChange: (next: Id) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <RadioGroup
        name={name}
        value={value}
        onChange={(next) => onChange(next as Id)}
        aria-label={label}
      >
        {options.map((option) => (
          <RadioField key={option.id}>
            <Radio intent="brand" value={option.id} aria-label={option.label} />
            <span className="text-sm text-foreground">{option.label}</span>
          </RadioField>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

export function QuoteCalculator() {
  const [who, setWho] = useState<WhoLive>(DEFAULT_QUOTE_ANSWERS.who);
  const [what, setWhat] = useState<WhatWork>(DEFAULT_QUOTE_ANSWERS.what);
  const [places, setPlaces] = useState<PlaceCount>(DEFAULT_QUOTE_ANSWERS.places);
  const quote = useMemo(() => resolveQuote({ who, what, places }), [who, what, places]);

  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow="Quote"
        eyebrowTone="primary"
        title={C.heading}
        description={C.body}
        align="center"
      />

      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-8 rounded-2xl bg-card p-8 ring-1 ring-border">
          <QuestionGroup
            name="who-puts-it-live"
            label={C.questions.who.label}
            value={who}
            options={C.questions.who.options}
            onChange={setWho}
          />
          <QuestionGroup
            name="what-has-to-work"
            label={C.questions.what.label}
            value={what}
            options={C.questions.what.options}
            onChange={setWhat}
          />
          <QuestionGroup
            name="how-many-places"
            label={C.questions.places.label}
            value={places}
            options={C.questions.places.options}
            onChange={setPlaces}
          />
        </div>

        <div
          className="flex flex-col justify-center gap-6 rounded-2xl bg-secondary p-8 ring-1 ring-border"
          data-testid="quote-card"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Quote
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{quote.title}</p>
            {quote.price ? (
              <p className="mt-1 text-3xl font-bold tracking-tight text-primary">{quote.price}</p>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm leading-6 text-body">
              {quote.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border pt-6">
            <ul className="space-y-2 text-sm leading-6 text-body">
              {quote.ownership.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-6 text-body">{quote.introCta.note}</p>
            <div className="mt-4">
              <Button asChild>
                <a href={quote.introCta.href} target="_blank" rel="noopener noreferrer">
                  {quote.introCta.label}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
