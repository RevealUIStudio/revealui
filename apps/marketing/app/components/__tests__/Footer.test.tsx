import { STUDIO_BLOG_HREF } from '@revealui/contracts/nav-docs-boundary';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from '../Footer';

describe('product footer', () => {
  it('links Blog to the Studio blog and keeps Docs on the product docs site', () => {
    render(<Footer />);
    const blog = screen.getByRole('link', { name: 'Blog' });
    expect(blog.getAttribute('href')).toBe(STUDIO_BLOG_HREF);
    expect(blog.getAttribute('target')).toBe('_blank');
    const docs = screen.getByRole('link', { name: 'Docs' });
    expect(docs.getAttribute('href')).toBe('https://docs.revealui.com');
    expect(docs.getAttribute('href')?.includes('/blog')).toBe(false);
  });
});
