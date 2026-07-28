import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRIMITIVES_FALLBACK_DATA, type PrimitivesData } from '../../lib/page-blocks';
import { Primitives } from '../landing/Primitives';

describe('Primitives: structural style keyed by index, not label', () => {
  it('keeps each card icon + accent color when an operator renames the label', () => {
    // Simulate the core P1 inline-edit flow: the first card's label is edited to
    // something that no longer matches the static const. Index-keyed lookup must
    // still resolve the first primitive's icon and accent color.
    const renamed: PrimitivesData = {
      ...PRIMITIVES_FALLBACK_DATA,
      items: PRIMITIVES_FALLBACK_DATA.items.map((item, index) =>
        index === 0 ? { ...item, label: 'Renamed By An Operator' } : item,
      ),
    };

    const { container, getByRole } = render(<Primitives data={renamed} />);

    // The edited label renders as the card heading...
    expect(getByRole('heading', { level: 3, name: 'Renamed By An Operator' })).toBeTruthy();

    // ...and the first card still shows an SVG icon (IconPrimitivePeople) with
    // the brand accent — not a label-lookup miss that would drop the icon.
    const icon = container.querySelector('svg[aria-label="Renamed By An Operator"]');
    expect(icon).not.toBeNull();

    // ...and the first card keeps the brand accent (index 0 → bg-primary/10).
    const accentDiv = icon?.closest('div');
    expect(accentDiv?.className).toContain('bg-primary/10');
  });

  it('renders five primitive icons by position', () => {
    const { container } = render(<Primitives />);
    const icons = container.querySelectorAll('svg[role="img"]');
    expect(icons.length).toBe(5);
  });
});
