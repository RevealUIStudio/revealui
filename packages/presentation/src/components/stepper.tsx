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
      <span className="flex size-8 items-center justify-center rounded-full bg-blue-600">
        <svg viewBox="0 0 16 16" fill="none" className="size-4 text-white" aria-hidden="true">
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
      <span className="flex size-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white dark:bg-zinc-900">
        <span className="size-2.5 rounded-full bg-blue-600" />
      </span>
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full border-2 border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900">
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
                      ? 'text-blue-600'
                      : step.status === 'complete'
                        ? 'text-zinc-950 dark:text-white'
                        : 'text-zinc-400 dark:text-zinc-500',
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
                    step.status === 'complete' ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700',
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
                      step.status === 'complete' ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700',
                    )}
                  />
                )}
              </div>
              <div className={cn('pb-6 pt-1', isLast && 'pb-0')}>
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.status === 'current'
                      ? 'text-blue-600'
                      : step.status === 'complete'
                        ? 'text-zinc-950 dark:text-white'
                        : 'text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
