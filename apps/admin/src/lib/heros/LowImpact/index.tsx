import type { HeroBlock } from '@revealui/core/types/admin';
import type React from 'react';
import RichText from '@/lib/components/RichText/index';

type LowImpactHeroType =
  | {
      children?: React.ReactNode;
      richText?: never;
    }
  | (Omit<HeroBlock, 'richText'> & {
      children?: never;
      richText?: HeroBlock['richText'];
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
