import { ChoiceCard, MarketingSection, SectionHeader } from '@revealui/presentation';
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
              <ChoiceCard
                selected={done}
                title={step.title}
                description={step.body}
                icon={
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                    {done ? (
                      <span aria-hidden="true">&#10003;</span>
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                }
                onClick={() => handleToggle(step.id)}
              />
            </li>
          );
        })}
      </ol>
    </MarketingSection>
  );
}
