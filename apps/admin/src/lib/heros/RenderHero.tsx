import type { HeroBlock } from '@revealui/core/types/admin';
import { HighImpactHero } from './HighImpact/index';
import { LowImpactHero } from './LowImpact/index';
import { MediumImpactHero } from './MediumImpact/index';

const heroes = {
  highImpact: HighImpactHero,
  lowImpact: LowImpactHero,
  mediumImpact: MediumImpactHero,
};

export const RenderHero = (props: HeroBlock) => {
  const { type } = props || {};

  if (!type || type === 'none') return null;

  const HeroToRender = heroes[type];

  if (!HeroToRender) return null;

  return <HeroToRender {...props} />;
};
