import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOME_HERO,
  HOME_HERO_FOUNDATION,
  HOME_HERO_L2,
  HOME_HERO_OWNERSHIP,
} from '../content/home';
import type { Audience } from '../lib/audience';
import { useAudienceHead } from '../lib/use-audience-head';

function addMeta(selector: string, attrName: string, attrValue: string): void {
  const el = document.createElement('meta');
  const openBracket = selector.indexOf('[');
  const closeBracket = selector.lastIndexOf(']');
  if (openBracket !== -1 && closeBracket !== -1) {
    const inner = selector.slice(openBracket + 1, closeBracket);
    const eqIdx = inner.indexOf('=');
    if (eqIdx !== -1) {
      el.setAttribute(inner.slice(0, eqIdx), inner.slice(eqIdx + 1).replaceAll('"', ''));
    }
  }
  el.setAttribute(attrName, attrValue);
  document.head.appendChild(el);
}

beforeEach(() => {
  document.head.innerHTML = '';
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://revealui.com/';
  document.head.appendChild(canonical);

  addMeta('meta[name="description"]', 'content', '');
  addMeta('meta[property="og:title"]', 'content', '');
  addMeta('meta[property="og:description"]', 'content', '');
  addMeta('meta[property="og:image"]', 'content', '');
  addMeta('meta[name="twitter:title"]', 'content', '');
  addMeta('meta[name="twitter:description"]', 'content', '');
  addMeta('meta[name="twitter:image"]', 'content', '');
});

afterEach(() => {
  delete document.documentElement.dataset.audience;
});

describe('useAudienceHead — non-technical audience', () => {
  it('sets document.title to the non-technical headline', () => {
    renderHook(() => useAudienceHead('non-technical'));
    expect(document.title).toBe('RevealUI | Implementation help from RevealUI Studio');
  });

  it('does not mutate link[rel=canonical]', () => {
    const before = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    renderHook(() => useAudienceHead('non-technical'));
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(before);
  });

  it('sets og:title to the non-technical title', () => {
    renderHook(() => useAudienceHead('non-technical'));
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(
      'RevealUI | Implementation help from RevealUI Studio',
    );
  });

  it('sets document.documentElement.dataset.audience to non-technical', () => {
    renderHook(() => useAudienceHead('non-technical'));
    expect(document.documentElement.dataset.audience).toBe('non-technical');
  });

  it('dispatches revealui:audience CustomEvent with correct detail', () => {
    const handler = vi.fn();
    document.addEventListener('revealui:audience', handler);
    renderHook(() => useAudienceHead('non-technical'));
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail).toEqual({
      audience: 'non-technical',
    });
    document.removeEventListener('revealui:audience', handler);
  });
});

describe('useAudienceHead — technical audience', () => {
  it('sets document.title to the technical headline', () => {
    renderHook(() => useAudienceHead('technical'));
    expect(document.title).toBe('RevealUI | Build your business on software you can run yourself.');
  });

  it('does not mutate link[rel=canonical]', () => {
    const before = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    renderHook(() => useAudienceHead('technical'));
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(before);
  });

  it('sets og:description to the technical description', () => {
    renderHook(() => useAudienceHead('technical'));
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content,
    ).toBe(
      `${HOME_HERO.subtitle.sentence1} ${HOME_HERO.subtitle.sentence2} ${HOME_HERO.subtitle.support}`,
    );
  });

  it('sets document.documentElement.dataset.audience to technical', () => {
    renderHook(() => useAudienceHead('technical'));
    expect(document.documentElement.dataset.audience).toBe('technical');
  });

  it('dispatches revealui:audience CustomEvent with correct detail', () => {
    const handler = vi.fn();
    document.addEventListener('revealui:audience', handler);
    renderHook(() => useAudienceHead('technical'));
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail).toEqual({
      audience: 'technical',
    });
    document.removeEventListener('revealui:audience', handler);
  });
});

describe('useAudienceHead — audience switch', () => {
  it('updates title and dataset when audience changes', () => {
    const { rerender } = renderHook(
      ({ audience }: { audience: Audience }) => useAudienceHead(audience),
      { initialProps: { audience: 'non-technical' as Audience } },
    );

    expect(document.title).toBe('RevealUI | Implementation help from RevealUI Studio');

    act(() => {
      rerender({ audience: 'technical' });
    });

    expect(document.title).toBe('RevealUI | Build your business on software you can run yourself.');
    expect(document.documentElement.dataset.audience).toBe('technical');
  });

  it('does not mutate canonical on either variant', () => {
    const before = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

    const { rerender } = renderHook(
      ({ audience }: { audience: Audience }) => useAudienceHead(audience),
      { initialProps: { audience: 'non-technical' as Audience } },
    );

    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(before);

    act(() => {
      rerender({ audience: 'technical' });
    });

    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(before);
  });
});

describe('useAudienceHead — query previews and return navigation', () => {
  it.each([HOME_HERO_FOUNDATION, HOME_HERO_OWNERSHIP, HOME_HERO_L2])(
    'uses the selected headline in the title and social card',
    (hero) => {
      renderHook(() => useAudienceHead('technical', hero));
      expect(document.title).toBe(`RevealUI | ${hero.h1}`);
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(
        document.title,
      );
      const image = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
      expect(new URL(image ?? '').searchParams.get('description')).toBe(hero.h1);
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      ).toContain(HOME_HERO.subtitle.support);
    },
  );

  it('updates the preview on query changes and restores the home canonical after another page', () => {
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute('href', 'https://revealui.com/pricing');
    const { rerender } = renderHook(({ hero }) => useAudienceHead('technical', hero), {
      initialProps: { hero: HOME_HERO_OWNERSHIP as typeof HOME_HERO | typeof HOME_HERO_OWNERSHIP },
    });
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://revealui.com/',
    );
    rerender({ hero: HOME_HERO });
    expect(document.title).toBe(`RevealUI | ${HOME_HERO.h1}`);
  });
});
