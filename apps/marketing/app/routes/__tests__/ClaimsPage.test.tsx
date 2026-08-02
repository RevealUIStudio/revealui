import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CLAIMS, COVERED_FILES } from '../../content/claims-evidence';
import { BLOG_POST_METADATA } from '../../lib/blog-registry';
import { ClaimsPage } from '../ClaimsPage';

afterEach(cleanup);

describe('ClaimsPage', () => {
  it('renders the locked H1', async () => {
    render(<ClaimsPage />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'The claims ledger' }),
    ).toBeInTheDocument();
  });

  it('renders live counts computed from the imported index, not hardcoded', async () => {
    render(<ClaimsPage />);
    expect(await screen.findByText(String(CLAIMS.length))).toBeInTheDocument();
    expect(
      await screen.findByText(String(COVERED_FILES.length + BLOG_POST_METADATA.length)),
    ).toBeInTheDocument();
  });

  it('renders one row per claims-evidence entry', async () => {
    render(<ClaimsPage />);
    const rows = await screen.findAllByTestId('claim-row');
    expect(rows).toHaveLength(CLAIMS.length);
  });

  it('renders a section for every covered file', async () => {
    render(<ClaimsPage />);
    for (const covered of COVERED_FILES) {
      const anchor = covered.file.endsWith('.ts') ? covered.file.slice(0, -3) : covered.file;
      const section = document.getElementById(anchor);
      expect(section, `missing section for ${covered.file}`).not.toBeNull();
    }
  });

  it('deep-links "code" evidence to the public GitHub repo', async () => {
    render(<ClaimsPage />);
    const allLinks = await screen.findAllByRole('link');
    const codeEvidenceHrefPrefix = 'https://github.com/RevealUIStudio/revealui/blob/main/';
    const codeLinks = allLinks.filter((link) =>
      (link.getAttribute('href') ?? '').startsWith(codeEvidenceHrefPrefix),
    );
    expect(codeLinks.length).toBeGreaterThan(0);
  });
});
