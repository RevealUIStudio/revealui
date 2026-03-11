/**
 * Listbox Component Tests
 *
 * Tests the Listbox compound component including option rendering,
 * selection, controlled/uncontrolled modes, and subcomponents.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

import {
  Listbox,
  ListboxDescription,
  ListboxLabel,
  ListboxOption,
} from '../../components/listbox.js';

function BasicListbox({
  onChange,
  value,
  defaultValue,
  disabled,
}: {
  onChange?: (value: string) => void;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
} = {}) {
  return (
    <Listbox
      aria-label="Color picker"
      placeholder="Select a color"
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
    >
      <ListboxOption value="red">Red</ListboxOption>
      <ListboxOption value="green">Green</ListboxOption>
      <ListboxOption value="blue">Blue</ListboxOption>
    </Listbox>
  );
}

describe('Listbox', () => {
  it('should render a trigger button with combobox role', () => {
    render(<BasicListbox />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display placeholder when no value is selected', () => {
    render(<BasicListbox />);
    expect(screen.getByText('Select a color')).toBeInTheDocument();
  });

  it('should set aria-label on the trigger', () => {
    render(<BasicListbox />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Color picker');
  });

  it('should open options listbox on trigger click', async () => {
    const user = userEvent.setup();
    render(<BasicListbox />);

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('should render all options when opened', async () => {
    const user = userEvent.setup();
    render(<BasicListbox />);

    await user.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('should display selected value text in trigger', () => {
    render(<BasicListbox defaultValue="green" />);
    expect(screen.getByText('Green')).toBeInTheDocument();
  });

  it('should set aria-expanded on trigger when open', async () => {
    const user = userEvent.setup();
    render(<BasicListbox />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('should call onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BasicListbox onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Blue'));

    expect(onChange).toHaveBeenCalledWith('blue');
  });

  it('should disable trigger when disabled prop is true', () => {
    render(<BasicListbox disabled />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });
});

describe('ListboxOption subcomponents', () => {
  it('should render ListboxLabel text', async () => {
    const user = userEvent.setup();
    render(
      <Listbox aria-label="Items">
        <ListboxOption value="item1">
          <ListboxLabel>Item One</ListboxLabel>
        </ListboxOption>
      </Listbox>,
    );

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Item One')).toBeInTheDocument();
  });

  it('should render ListboxDescription text', async () => {
    const user = userEvent.setup();
    render(
      <Listbox aria-label="Items">
        <ListboxOption value="item1">
          <ListboxLabel>Item One</ListboxLabel>
          <ListboxDescription>First item</ListboxDescription>
        </ListboxOption>
      </Listbox>,
    );

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('First item')).toBeInTheDocument();
  });
});
