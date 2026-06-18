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
    title: 'RevealUI | Your business grows with you, and stays at the frontier.',
    description:
      'Running a business is hard enough without racing to keep up with AI. We build your software with AI built in, yours to own, and keep it current as the world moves.',
    ogTitle: 'RevealUI | Your business grows with you, and stays at the frontier.',
    ogDescription:
      'Running a business is hard enough without racing to keep up with AI. We build your software with AI built in, yours to own, and keep it current as the world moves.',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Your%20business%2C%20delivered%20and%20yours%20to%20own.',
    twitterTitle: 'RevealUI | Your business grows with you, and stays at the frontier.',
    twitterDescription:
      'Running a business is hard enough without racing to keep up with AI. We build your software with AI built in, yours to own, and keep it current as the world moves.',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Your%20business%2C%20delivered%20and%20yours%20to%20own.',
  },
  technical: {
    title: 'RevealUI | Run your whole business on one runtime you own.',
    description:
      'Auth, content, products, and payments, pre-wired into one open-source runtime you self-host. Ship one product or stamp a branded copy per client.',
    ogTitle: 'RevealUI | Run your whole business on one runtime you own.',
    ogDescription:
      'Auth, content, products, and payments, pre-wired into one open-source runtime you self-host. Ship one product or stamp a branded copy per client.',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Run%20your%20whole%20business%20on%20one%20runtime%20you%20own.',
    twitterTitle: 'RevealUI | Run your whole business on one runtime you own.',
    twitterDescription:
      'Auth, content, products, and payments, pre-wired into one open-source runtime you self-host. Ship one product or stamp a branded copy per client.',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Run%20your%20whole%20business%20on%20one%20runtime%20you%20own.',
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
