import type { ComponentProps, ReactNode } from 'react';
import { Container } from '@/components/revealui/elements/container';
import { Heading } from '@/components/revealui/elements/heading';
import { Text } from '@/components/revealui/elements/text';
import { cn } from '@/lib/utils/cn';

export function HeroLeftAlignedWithDemo({
  eyebrow,
  headline,
  subheadline,
  cta,
  demo,
  footer,
  className,
  ...props
}: {
  eyebrow?: ReactNode;
  headline: ReactNode;
  subheadline: ReactNode;
  cta?: ReactNode;
  demo?: ReactNode;
  footer?: ReactNode;
} & ComponentProps<'section'>) {
  return (
    <section className={cn('py-16', className)} {...props}>
      <Container className="flex flex-col gap-16">
        <div className="flex flex-col gap-32">
          <div className="flex flex-col items-start gap-6">
            {eyebrow}
            <Heading className="max-w-5xl">{headline}</Heading>
            <Text size="lg" className="flex max-w-3xl flex-col gap-4">
              {subheadline}
            </Text>
            {cta}
          </div>
          {demo}
        </div>
        {footer}
      </Container>
    </section>
  );
}
