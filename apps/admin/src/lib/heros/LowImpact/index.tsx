import type { Page } from '@revealui/core/types/admin';
import type React from 'react';
import RichText from '@/lib/components/RichText/index';

type LowImpactHeroType =
  | {
      children?: React.ReactNode;
      richText?: never;
    }
  | (Omit<Page['hero'], 'richText'> & {
      children?: never;
      richText?: Page['hero']['richText'];
    });

export const LowImpactHero = ({ children, richText }: LowImpactHeroType) => {
  return (
    <div className="container mt-16">
      <div className="max-w-3xl">
        {children || (richText && <RichText content={richText} enableGutter={false} />)}
      </div>
    </div>
  );
};
