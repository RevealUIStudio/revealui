import { cn } from '../utils/cn.js';

type StepStatus = 'complete' | 'current' | 'upcoming';

export type StepperStep = {
  label: string;
  description?: string;
  status: StepStatus;
};

export function Stepper({
  steps,
  orientation = 'horizontal',
  className,
}: {
  steps: StepperStep[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return orientation === 'vertical' ? (
    <StepperVertical steps={steps} className={className} />
  ) : (
    <StepperHorizontal steps={steps} className={className} />
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'complete') {
    return (
      <span className="flex size-8 items-center justify-center rounded-full bg-primary">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="size-4 text-primary-foreground"
          aria-hidden="true"
        >
          <path
            d="M3 8l3.5 3.5L13 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-card">
        <span className="size-2.5 rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full border-2 border-input bg-card">
      <span className="size-2.5 rounded-full bg-transparent" />
    </span>
  );
}

function StepperHorizontal({ steps, className }: { steps: StepperStep[]; className?: string }) {
  return (
    <nav aria-label="Progress">
      <ol className={cn('flex items-center', className)}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: stepper steps are positionally ordered with no stable ID
              key={index}
              aria-current={step.status === 'current' ? 'step' : undefined}
              className={cn('flex items-center', !isLast && 'flex-1')}
            >
              <div className="flex flex-col items-center gap-1.5">
                <StepIcon status={step.status} />
                <span
                  className={cn(
                    'text-xs font-medium',
                    step.status === 'current'
                      ? 'text-primary'
                      : step.status === 'complete'
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'mx-3 h-px flex-1',
                    step.status === 'complete' ? 'bg-primary' : 'bg-surface-2',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepperVertical({ steps, className }: { steps: StepperStep[]; className?: string }) {
  return (
    <nav aria-label="Progress">
      <ol className={cn('space-y-0', className)}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: stepper steps are positionally ordered with no stable ID
              key={index}
              aria-current={step.status === 'current' ? 'step' : undefined}
              className="relative flex gap-4"
            >
              <div className="flex flex-col items-center">
                <StepIcon status={step.status} />
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'w-px flex-1',
                      step.status === 'complete' ? 'bg-primary' : 'bg-surface-2',
                    )}
                  />
                )}
              </div>
              <div className={cn('pb-6 pt-1', isLast && 'pb-0')}>
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.status === 'current'
                      ? 'text-primary'
                      : step.status === 'complete'
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
