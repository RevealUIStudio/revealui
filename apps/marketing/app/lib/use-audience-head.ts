import { useEffect } from 'react';
import { HOME_HERO } from '../content/home';
import type { Audience } from './audience';
import type { HomeHeroVariant } from './hero-variant';

function setMeta(selector: string, attr: string, value: string): void {
  document.querySelector<HTMLElement>(selector)?.setAttribute(attr, value);
}

/** Homepage metadata follows the selected hero and restores the home canonical. */
export function useAudienceHead(audience: Audience, hero: HomeHeroVariant = HOME_HERO): void {
  useEffect(() => {
    const title =
      audience === 'technical'
        ? `RevealUI | ${hero.h1}`
        : 'RevealUI | Implementation help from RevealUI Studio';
    const description =
      audience === 'technical'
        ? `${hero.subtitle.sentence1} ${hero.subtitle.sentence2} ${hero.subtitle.support}`
        : 'Work with RevealUI Studio to review, test, or launch a business flow on your accounts. Implementation engagements are separate from RevealUI licenses.';
    const image = `https://api.revealui.com/api/og?title=RevealUI&description=${encodeURIComponent(audience === 'technical' ? hero.h1 : description)}`;

    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[property="og:image:alt"]', 'content', title);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', image);
    setMeta('link[rel="canonical"]', 'href', 'https://revealui.com');
    setMeta('meta[property="og:url"]', 'content', 'https://revealui.com');

    document.documentElement.dataset.audience = audience;
    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience }, bubbles: false }),
    );
  }, [audience, hero]);
}
