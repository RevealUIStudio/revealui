/**
 * Radio Component Tests
 *
 * Tests the Radio, RadioGroup, and RadioField components for rendering,
 * selection, controlled/uncontrolled state, disabled behavior, and form integration.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Radio, RadioField, RadioGroup } from '../../components/radio.js';

describe('RadioGroup', () => {
  it('should render with radiogroup role', () => {
    render(
      <RadioGroup>
        <Radio value="a" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('should render radio children with radio role', () => {
    render(
      <RadioGroup>
        <Radio value="a" />
        <Radio value="b" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });
});

describe('Radio', () => {
  it('should select on click', async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup>
        <Radio value="a" />
        <Radio value="b" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');

    await user.click(radios[0]!);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');

    await user.click(radios[1]!);
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('should work in controlled mode with onChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <RadioGroup value="a" onChange={handleChange}>
        <Radio value="a" />
        <Radio value="b" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    await user.click(radios[1]!);
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('should work uncontrolled with defaultValue', () => {
    render(
      <RadioGroup defaultValue="b">
        <Radio value="a" />
        <Radio value="b" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('should not change when disabled', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <RadioGroup disabled onChange={handleChange}>
        <Radio value="a" />
        <Radio value="b" />
      </RadioGroup>,
    );

    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]!);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should render hidden input when name is provided and checked', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <RadioGroup name="color">
        <Radio value="red" />
        <Radio value="blue" />
      </RadioGroup>,
    );

    // No hidden input initially (nothing selected, default value is '')
    let hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput).not.toBeInTheDocument();

    // Click to select
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]!);

    hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput).toHaveAttribute('name', 'color');
    expect(hiddenInput).toHaveAttribute('value', 'red');
  });

  it('should not render hidden input when name is not provided', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <RadioGroup>
        <Radio value="a" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio'));

    const hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput).not.toBeInTheDocument();
  });
});

describe('RadioField', () => {
  it('should render with data-slot="field"', () => {
    render(
      <RadioGroup>
        <RadioField data-testid="field">
          <Radio value="a" />
        </RadioField>
      </RadioGroup>,
    );

    expect(screen.getByTestId('field')).toHaveAttribute('data-slot', 'field');
  });

  it('should set data-disabled when disabled', () => {
    render(
      <RadioGroup>
        <RadioField disabled data-testid="field">
          <Radio value="a" />
        </RadioField>
      </RadioGroup>,
    );

    expect(screen.getByTestId('field')).toHaveAttribute('data-disabled', '');
  });
});
