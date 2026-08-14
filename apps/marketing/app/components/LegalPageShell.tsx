import { Callout, MarketingSection, SectionHeader } from '@revealui/presentation';
import type React from 'react';
import type { ReactNode } from 'react';
import { Footer } from './Footer';

export interface LegalNoticeView {
  readonly variant: 'info' | 'warning' | 'success';
  readonly title: string;
  readonly body: ReactNode;
}

interface LegalPageShellProps {
  readonly title: string;
  readonly lastUpdated: string;
  readonly intro: string;
  readonly notice?: LegalNoticeView;
  readonly width?: 'narrow' | 'default';
  readonly children: ReactNode;
}

/**
 * Shared legal / policy page composition. Routes keep their section maps;
 * this shell owns tone, type ladder, and the optional honesty Callout.
 */
export function LegalPageShell({
  title,
  lastUpdated,
  intro,
  notice,
  width = 'narrow',
  children,
}: LegalPageShellProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      {notice ? (
        <MarketingSection tone="background" density="compact" width={width}>
          <Callout variant={notice.variant} title={notice.title}>
            {notice.body}
          </Callout>
        </MarketingSection>
      ) : null}
      <MarketingSection
        tone="background"
        density="spacious"
        width={width}
        className={notice ? 'pt-4 sm:pt-6' : undefined}
      >
        <SectionHeader
          title={title}
          description={intro}
          titleAs="h1"
          titleClassName="font-display text-4xl sm:text-5xl"
        />
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        <div className="mt-10 space-y-8 text-body [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:leading-7 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
