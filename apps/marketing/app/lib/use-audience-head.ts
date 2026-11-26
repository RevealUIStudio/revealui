import { useEffect } from 'react';
import { HOME_HERO } from '../content/home';
import type { Audience } from './audience';
import { publishDocumentHead } from './document-head';
import type { HomeHeroVariant } from './hero-variant';
import { marketingCanonical } from './route-heads';

function upsertMeta(selector: string, attr: string, value: string): void {
  let el = document.querySelector<HTMLElement>(selector);
  if (el === null) {
    if (selector.startsWith('meta[')) {
      el = document.createElement('meta');
    } else if (selector.startsWith('link[')) {
      el = document.createElement('link');
    } else {
      return;
    }
    const open = selector.indexOf('[');
    const close = selector.lastIndexOf(']');
    if (open !== -1 && close !== -1) {
      const inner = selector.slice(open + 1, close);
      const eq = inner.indexOf('=');
      if (eq !== -1) {
        el.setAttribute(inner.slice(0, eq), inner.slice(eq + 1).replaceAll('"', ''));
      }
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
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
    upsertMeta('meta[name="description"]', 'content', description);
    upsertMeta('meta[property="og:title"]', 'content', title);
    upsertMeta('meta[property="og:description"]', 'content', description);
    upsertMeta('meta[property="og:image"]', 'content', image);
    upsertMeta('meta[property="og:image:alt"]', 'content', title);
    upsertMeta('meta[name="twitter:title"]', 'content', title);
    upsertMeta('meta[name="twitter:description"]', 'content', description);
    upsertMeta('meta[name="twitter:image"]', 'content', image);
    const canonical = marketingCanonical('/');
    upsertMeta('link[rel="canonical"]', 'href', canonical);
    upsertMeta('meta[property="og:url"]', 'content', canonical);
    document.head.querySelector('meta[name="robots"]')?.remove();

    document.documentElement.dataset.audience = audience;
    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience }, bubbles: false }),
    );
    publishDocumentHead();
  }, [audience, hero]);
}
