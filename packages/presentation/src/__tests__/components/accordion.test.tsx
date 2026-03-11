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

  it('is collapsed by default', () => {
    render(
      <Accordion>
        <AccordionItem title="Closed">Hidden content</AccordionItem>
      </Accordion>,
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('expands when defaultOpen is true', () => {
    render(
      <Accordion>
        <AccordionItem title="Open" defaultOpen>
          Visible content
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('toggles open and closed on click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <AccordionItem title="Toggle me">Inner content</AccordionItem>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: /Toggle me/i });
    expect(screen.queryByText('Inner content')).not.toBeInTheDocument();

    await user.click(button);
    expect(screen.getByText('Inner content')).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText('Inner content')).not.toBeInTheDocument();
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
    expect(screen.getByText('First content')).toBeInTheDocument();
    expect(screen.queryByText('Second content')).not.toBeInTheDocument();
  });
});
