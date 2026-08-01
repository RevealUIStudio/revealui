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
    title: 'RevealUI | Build it once. Every product after starts ahead.',
    // Title mirrors HOME_HERO.h1 (L1 default, 2026-07-29). Description mirrors
    // HOME_HERO subtitle (sentence1 + interim-safe sentence2 + support).
    description:
      'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. Your team and your agents work the same objects under the same access rules on your infrastructure. It runs on any AI provider you choose.',
    ogTitle: 'RevealUI | Build it once. Every product after starts ahead.',
    ogDescription:
      'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. Your team and your agents work the same objects under the same access rules on your infrastructure.',
    ogImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Build%20it%20once.%20Every%20product%20after%20starts%20ahead.',
    twitterTitle: 'RevealUI | Build it once. Every product after starts ahead.',
    twitterDescription:
      'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. Your team and your agents work the same objects under the same access rules on your infrastructure.',
    twitterImage:
      'https://api.revealui.com/api/og?title=RevealUI&description=Build%20it%20once.%20Every%20product%20after%20starts%20ahead.',
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
