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
    title: 'RevealUI | One self-hosted runtime for your business and the agents that run it.',
    // Title mirrors HOME_HERO.h1. Description mirrors the Auditor subtitle.
    description:
      'Your business and the agents that run it share the same data, sign-in, and plan rules on infrastructure you own. Every agent is a governed and audited user that lives on your infrastructure. It runs on any AI provider you choose.',
    ogTitle: 'RevealUI | One self-hosted runtime for your business and the agents that run it.',
    ogDescription:
      'Your business and the agents that run it share the same data, sign-in, and plan rules on infrastructure you own. Every agent is a governed and audited user that lives on your infrastructure.',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=One%20self-hosted%20runtime%20for%20your%20business%20and%20the%20agents%20that%20run%20it.',
    twitterTitle:
      'RevealUI | One self-hosted runtime for your business and the agents that run it.',
    twitterDescription:
      'Your business and the agents that run it share the same data, sign-in, and plan rules on infrastructure you own. Every agent is a governed and audited user that lives on your infrastructure.',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=One%20self-hosted%20runtime%20for%20your%20business%20and%20the%20agents%20that%20run%20it.',
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
