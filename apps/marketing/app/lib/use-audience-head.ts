import { useEffect } from 'react';
import type { Audience } from './audience';

interface AudienceSeo {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

const SEO: Record<Audience, AudienceSeo> = {
  'non-technical': {
    title: 'RevealUI | Consultation, Pilot, or Launch on infrastructure you own.',
    description:
      'Studio books Consultation, Pilot, and Launch on Google Calendar. The runtime stays on infrastructure you own. These SKUs live on revealuistudio.com.',
    ogTitle: 'RevealUI | Consultation, Pilot, or Launch on infrastructure you own.',
    ogDescription:
      'Studio books Consultation, Pilot, and Launch on Google Calendar. The runtime stays on infrastructure you own. These SKUs live on revealuistudio.com.',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Your%20business%2C%20delivered%20and%20yours%20to%20own.',
    twitterTitle: 'RevealUI | Consultation, Pilot, or Launch on infrastructure you own.',
    twitterDescription:
      'Studio books Consultation, Pilot, and Launch on Google Calendar. The runtime stays on infrastructure you own. These SKUs live on revealuistudio.com.',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Your%20business%2C%20delivered%20and%20yours%20to%20own.',
  },
  technical: {
    title: 'RevealUI | The agentic business runtime startups operate on their own domain.',
    // Title mirrors HOME_HERO.h1. Description mirrors the known-for subtitle.
    description:
      'Technical founders and small agencies who already run agents — existing tools report in, you keep the stack. Powerful and safe: agents leave receipts when it matters, and the catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr). It runs on any AI provider you choose.',
    ogTitle: 'RevealUI | The agentic business runtime startups operate on their own domain.',
    ogDescription:
      'Technical founders and small agencies who already run agents — existing tools report in, you keep the stack. Powerful and safe: agents leave receipts when it matters, and the catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr).',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=The%20agentic%20business%20runtime%20startups%20operate%20on%20their%20own%20domain.',
    twitterTitle: 'RevealUI | The agentic business runtime startups operate on their own domain.',
    twitterDescription:
      'Technical founders and small agencies who already run agents — existing tools report in, you keep the stack. Powerful and safe: agents leave receipts when it matters, and the catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr).',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=The%20agentic%20business%20runtime%20startups%20operate%20on%20their%20own%20domain.',
  },
};

function setMeta(selector: string, attr: string, value: string): void {
  document.querySelector<HTMLElement>(selector)?.setAttribute(attr, value);
}

export function useAudienceHead(audience: Audience): void {
  useEffect(() => {
    const seo = SEO[audience];

    document.title = seo.title;

    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[property="og:title"]', 'content', seo.ogTitle);
    setMeta('meta[property="og:description"]', 'content', seo.ogDescription);
    setMeta('meta[property="og:image"]', 'content', seo.ogImage);
    setMeta('meta[name="twitter:title"]', 'content', seo.twitterTitle);
    setMeta('meta[name="twitter:description"]', 'content', seo.twitterDescription);
    setMeta('meta[name="twitter:image"]', 'content', seo.twitterImage);

    document.documentElement.dataset.audience = audience;

    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience }, bubbles: false }),
    );
  }, [audience]);
}
