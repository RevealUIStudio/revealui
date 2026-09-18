import { MarketingSection, SectionHeader } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import {
  CONSULTATION_JOURNEY,
  type ConsultationJourneyProgress,
  type ConsultationStepId,
  readConsultationProgress,
  toggleConsultationStep,
  writeConsultationProgress,
} from '../../content/consultation-journey';

export function ConsultationJourney() {
  const [progress, setProgress] = useState<ConsultationJourneyProgress>({ completed: [] });

  useEffect(() => {
    setProgress(readConsultationProgress());
  }, []);

  const handleToggle = (id: ConsultationStepId) => {
    const next = toggleConsultationStep(progress, id);
    writeConsultationProgress(next);
    setProgress(next);
  };

  return (
    <MarketingSection
      id="consultation-journey"
      tone="background"
      density="default"
      width="default"
      className="scroll-mt-24"
    >
      <SectionHeader
        eyebrow={CONSULTATION_JOURNEY.eyebrow}
        eyebrowTone="muted"
        title={CONSULTATION_JOURNEY.heading}
        description={CONSULTATION_JOURNEY.body}
        align="center"
      />

      <ol className="mx-auto mt-12 grid max-w-4xl list-none grid-cols-1 gap-4 p-0 sm:mt-14">
        {CONSULTATION_JOURNEY.steps.map((step, index) => {
          const done = progress.completed.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => handleToggle(step.id)}
                aria-pressed={done}
                className={
                  done
                    ? 'grid w-full grid-cols-[auto_1fr] gap-6 rounded-2xl bg-card p-6 text-left ring-1 ring-primary/40 sm:p-8'
                    : 'grid w-full grid-cols-[auto_1fr] gap-6 rounded-2xl bg-card p-6 text-left ring-1 ring-border sm:p-8'
                }
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-base font-semibold text-primary">
                  {done ? (
                    <span aria-hidden="true">&#10003;</span>
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold leading-7 text-foreground">{step.title}</h3>
                  <p className="mt-2 text-base leading-7 text-body">{step.body}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </MarketingSection>
  );
}
