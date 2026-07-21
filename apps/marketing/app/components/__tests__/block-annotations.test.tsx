import type { BlockAnnotation } from '@revealui/presentation';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOME_DEMO, HOME_FAQ, HOME_GET_STARTED } from '../../content/home';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../../content/primitives';
import { PRODUCTS_CTA_SECTION, PRODUCTS_PAGE_HERO } from '../../content/products';
import { GetStarted } from '../GetStarted';
import { Demo } from '../landing/Demo';
import { Faq } from '../landing/Faq';
import { Primitives } from '../landing/Primitives';
import { ProductsCta } from '../products/ProductsCta';
import { ProductsHero } from '../products/ProductsHero';

const ACTIVE: BlockAnnotation = { docId: 'home', editable: true };

describe('block-driven marketing sections: annotation suppression (inactive)', () => {
  it('emits zero data-rvui-* attributes with default (inactive) annotation', () => {
    for (const ui of [
      <Demo />,
      <Primitives />,
      <GetStarted />,
      <Faq />,
      <ProductsHero />,
      <ProductsCta />,
    ]) {
      const { container, unmount } = render(ui);
      expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
      expect(container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
      unmount();
    }
  });

  it('renders the copy identically whether or not annotation is active (visual parity)', () => {
    const inactive = render(<Demo />);
    expect(inactive.getByText(HOME_DEMO.heading)).toBeTruthy();
    expect(inactive.getByText(HOME_DEMO.body)).toBeTruthy();
    inactive.unmount();

    const active = render(<Demo path="blocks.0.data" annotation={ACTIVE} />);
    expect(active.getByText(HOME_DEMO.heading)).toBeTruthy();
    expect(active.getByText(HOME_DEMO.body)).toBeTruthy();
  });
});

// Every field path lives under `blocks.<index>.data.*`  -  the same structure
// a session server's materialized draft carries (see the RenderBlocks +
// page-blocks contract test for the cross-seam version of this assertion).
describe('block-driven marketing sections: annotation emission (active)', () => {
  it('Demo emits field paths on heading, body, and repeater items', () => {
    const { container } = render(<Demo path="blocks.0.data" annotation={ACTIVE} />);
    const heading = container.querySelector('[data-rvui-field="blocks.0.data.heading"]');
    expect(heading?.getAttribute('data-rvui-doc')).toBe('home');
    expect(heading?.textContent).toBe(HOME_DEMO.heading);
    expect(container.querySelector('[data-rvui-field="blocks.0.data.body"]')?.textContent).toBe(
      HOME_DEMO.body,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.0.data.items.0.title"]')?.textContent,
    ).toBe(HOME_DEMO.beats[0]?.title);
    expect(
      container.querySelector('[data-rvui-field="blocks.0.data.items.0.label"]')?.textContent,
    ).toBe(HOME_DEMO.beats[0]?.n);
  });

  it('Primitives emits field paths on heading, body, and repeater items', () => {
    const { container } = render(<Primitives path="blocks.1.data" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.1.data.heading"]')?.textContent).toBe(
      HOME_PRIMITIVES_SECTION.heading,
    );
    expect(container.querySelector('[data-rvui-field="blocks.1.data.body"]')?.textContent).toBe(
      HOME_PRIMITIVES_SECTION.body,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.1.data.items.0.label"]')?.textContent,
    ).toBe(HOME_PRIMITIVES[0]?.label);
    expect(
      container.querySelector('[data-rvui-field="blocks.1.data.items.0.body"]')?.textContent,
    ).toBe(HOME_PRIMITIVES[0]?.body);
  });

  it('GetStarted emits field paths on heading, body, and snippet', () => {
    const { container } = render(<GetStarted path="blocks.2.data" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.2.data.heading"]')?.textContent).toBe(
      HOME_GET_STARTED.heading,
    );
    expect(container.querySelector('[data-rvui-field="blocks.2.data.body"]')?.textContent).toBe(
      HOME_GET_STARTED.body,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.2.data.snippet.caption"]')?.textContent,
    ).toBe(HOME_GET_STARTED.cli.caption);
    expect(
      container.querySelector('[data-rvui-field="blocks.2.data.snippet.lines"]'),
    ).not.toBeNull();
  });

  it('Faq emits field paths on heading and per-item question + answer', () => {
    const { container } = render(<Faq path="blocks.1.data" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.1.data.heading"]')?.textContent).toBe(
      HOME_FAQ.heading,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.1.data.items.0.label"]')?.textContent,
    ).toBe(HOME_FAQ.items[0]?.question);
    expect(
      container.querySelector('[data-rvui-field="blocks.1.data.items.0.body"]')?.textContent,
    ).toBe(HOME_FAQ.items[0]?.answer);
  });

  it('ProductsHero emits field paths on title and subtitle', () => {
    const { container } = render(<ProductsHero path="blocks.0.data" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.0.data.title"]')?.textContent).toBe(
      PRODUCTS_PAGE_HERO.h1,
    );
    expect(container.querySelector('[data-rvui-field="blocks.0.data.subtitle"]')?.textContent).toBe(
      PRODUCTS_PAGE_HERO.subtitle,
    );
  });

  it('ProductsCta emits field paths on heading, body, and snippet', () => {
    const { container } = render(<ProductsCta path="blocks.2.data" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.2.data.heading"]')?.textContent).toBe(
      PRODUCTS_CTA_SECTION.heading,
    );
    expect(container.querySelector('[data-rvui-field="blocks.2.data.body"]')?.textContent).toBe(
      PRODUCTS_CTA_SECTION.body,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.2.data.snippet.lines"]'),
    ).not.toBeNull();
  });
});
