import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Accordion, AccordionItem } from '../../components/accordion.js';

describe('Accordion', () => {
  it('renders items', () => {
    render(
      <Accordion>
        <AccordionItem title="Section 1">Content 1</AccordionItem>
        <AccordionItem title="Section 2">Content 2</AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    expect(screen.getByText('Section 2')).toBeInTheDocument();
  });

  it('keeps panel content mounted but hidden when collapsed', () => {
    render(
      <Accordion>
        <AccordionItem title="Closed">Hidden content</AccordionItem>
      </Accordion>,
    );
    const panel = screen.getByText('Hidden content');
    expect(panel).toBeInTheDocument();
    expect(panel.closest('section')).toHaveAttribute('hidden');
  });

  it('expands when defaultOpen is true', () => {
    render(
      <Accordion>
        <AccordionItem title="Open" defaultOpen>
          Visible content
        </AccordionItem>
      </Accordion>,
    );
    const panel = screen.getByText('Visible content').closest('section');
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('toggles open and closed on click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <AccordionItem title="Toggle me">Inner content</AccordionItem>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: /Toggle me/i });
    const panel = screen.getByText('Inner content').closest('section');
    expect(panel).toHaveAttribute('hidden');

    await user.click(button);
    expect(panel).not.toHaveAttribute('hidden');

    await user.click(button);
    expect(panel).toHaveAttribute('hidden');
  });

  it('sets aria-expanded correctly', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <AccordionItem title="Aria test">Content</AccordionItem>
      </Accordion>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('multiple items are independent', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <AccordionItem title="First">First content</AccordionItem>
        <AccordionItem title="Second">Second content</AccordionItem>
      </Accordion>,
    );
    const [first] = screen.getAllByRole('button');
    await user.click(first);
    expect(screen.getByText('First content').closest('section')).not.toHaveAttribute('hidden');
    expect(screen.getByText('Second content').closest('section')).toHaveAttribute('hidden');
  });
});
