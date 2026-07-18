import type { BlockAnnotation } from '@revealui/presentation';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOME_DEMO, HOME_GET_STARTED } from '../../content/home';
import { PRODUCTS_CTA_SECTION, PRODUCTS_PAGE_HERO } from '../../content/products';
import { GetStarted } from '../GetStarted';
import { Demo } from '../landing/Demo';
import { ProductsCta } from '../products/ProductsCta';
import { ProductsHero } from '../products/ProductsHero';

const ACTIVE: BlockAnnotation = { docId: 'home', editable: true };

describe('block-driven marketing sections: annotation suppression (inactive)', () => {
  it('emits zero data-rvui-* attributes with default (inactive) annotation', () => {
    for (const ui of [<Demo />, <GetStarted />, <ProductsHero />, <ProductsCta />]) {
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

    const active = render(<Demo path="blocks.0" annotation={ACTIVE} />);
    expect(active.getByText(HOME_DEMO.heading)).toBeTruthy();
    expect(active.getByText(HOME_DEMO.body)).toBeTruthy();
  });
});

describe('block-driven marketing sections: annotation emission (active)', () => {
  it('Demo emits field paths on heading, body, and repeater items', () => {
    const { container } = render(<Demo path="blocks.0" annotation={ACTIVE} />);
    const heading = container.querySelector('[data-rvui-field="blocks.0.heading"]');
    expect(heading?.getAttribute('data-rvui-doc')).toBe('home');
    expect(heading?.textContent).toBe(HOME_DEMO.heading);
    expect(container.querySelector('[data-rvui-field="blocks.0.body"]')?.textContent).toBe(
      HOME_DEMO.body,
    );
    expect(container.querySelector('[data-rvui-field="blocks.0.items.0.title"]')?.textContent).toBe(
      HOME_DEMO.beats[0]?.title,
    );
    expect(container.querySelector('[data-rvui-field="blocks.0.items.0.label"]')?.textContent).toBe(
      HOME_DEMO.beats[0]?.n,
    );
  });

  it('GetStarted emits field paths on heading, body, and snippet', () => {
    const { container } = render(<GetStarted path="blocks.1" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.1.heading"]')?.textContent).toBe(
      HOME_GET_STARTED.heading,
    );
    expect(container.querySelector('[data-rvui-field="blocks.1.body"]')?.textContent).toBe(
      HOME_GET_STARTED.body,
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.1.snippet.caption"]')?.textContent,
    ).toBe(HOME_GET_STARTED.cli.caption);
    expect(container.querySelector('[data-rvui-field="blocks.1.snippet.lines"]')).not.toBeNull();
  });

  it('ProductsHero emits field paths on title and subtitle', () => {
    const { container } = render(<ProductsHero path="blocks.0" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.0.title"]')?.textContent).toBe(
      PRODUCTS_PAGE_HERO.h1,
    );
    expect(container.querySelector('[data-rvui-field="blocks.0.subtitle"]')?.textContent).toBe(
      PRODUCTS_PAGE_HERO.subtitle,
    );
  });

  it('ProductsCta emits field paths on heading, body, and snippet', () => {
    const { container } = render(<ProductsCta path="blocks.1" annotation={ACTIVE} />);
    expect(container.querySelector('[data-rvui-field="blocks.1.heading"]')?.textContent).toBe(
      PRODUCTS_CTA_SECTION.heading,
    );
    expect(container.querySelector('[data-rvui-field="blocks.1.body"]')?.textContent).toBe(
      PRODUCTS_CTA_SECTION.body,
    );
    expect(container.querySelector('[data-rvui-field="blocks.1.snippet.lines"]')).not.toBeNull();
  });
});
