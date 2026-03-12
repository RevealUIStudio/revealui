import type { Page } from '@revealui/core/types/cms';
import { HighImpactHero } from './HighImpact/index';
import { LowImpactHero } from './LowImpact/index';
import { MediumImpactHero } from './MediumImpact/index';

const heroes = {
  highImpact: HighImpactHero,
  lowImpact: LowImpactHero,
  mediumImpact: MediumImpactHero,
};

export const RenderHero = (props: Page['hero']) => {
  const { type } = props || {};

  if (!type || type === 'none') return null;

  const HeroToRender = heroes[type];

  if (!HeroToRender) return null;

  return <HeroToRender {...props} />;
};
