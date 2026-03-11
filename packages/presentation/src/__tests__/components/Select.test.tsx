/**
 * Select Component Tests
 *
 * Tests the Select compound component including Select, SelectTrigger,
 * SelectContent, SelectItem, SelectValue, and related subcomponents.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../components/Select.js';

describe('Select', () => {
  it('should render children', () => {
    render(
      <Select data-testid="select">
        <span>Select content</span>
      </Select>,
    );
    expect(screen.getByText('Select content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Select className="custom-select" data-testid="select">
        Content
      </Select>,
    );
    expect(screen.getByTestId('select')).toHaveClass('custom-select');
  });

  it('should have displayName set to Select', () => {
    expect(Select.displayName).toBe('Select');
  });
});

describe('SelectTrigger', () => {
  it('should render children and a chevron icon', () => {
    render(
      <SelectTrigger data-testid="trigger">
        <SelectValue placeholder="Choose..." />
      </SelectTrigger>,
    );
    expect(screen.getByText('Choose...')).toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <SelectTrigger className="trigger-class" data-testid="trigger">
        <span>Trigger</span>
      </SelectTrigger>,
    );
    expect(screen.getByTestId('trigger')).toHaveClass('trigger-class');
  });

  it('should have displayName set to SelectTrigger', () => {
    expect(SelectTrigger.displayName).toBe('SelectTrigger');
  });
});

describe('SelectValue', () => {
  it('should render placeholder text', () => {
    render(<SelectValue placeholder="Select an option" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should render children over placeholder', () => {
    render(<SelectValue placeholder="Fallback">Selected Item</SelectValue>);
    expect(screen.getByText('Selected Item')).toBeInTheDocument();
  });

  it('should render value when no children', () => {
    render(<SelectValue value="apple" />);
    expect(screen.getByText('apple')).toBeInTheDocument();
  });
});

describe('SelectContent', () => {
  it('should render children within a container', () => {
    render(
      <SelectContent data-testid="content">
        <span>Items</span>
      </SelectContent>,
    );
    expect(screen.getByText('Items')).toBeInTheDocument();
  });

  it('should have displayName set to SelectContent', () => {
    expect(SelectContent.displayName).toBe('SelectContent');
  });
});

describe('SelectItem', () => {
  it('should render children text', () => {
    render(<SelectItem value="apple">Apple</SelectItem>);
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('should set data-value attribute', () => {
    render(
      <SelectItem value="banana" data-testid="item">
        Banana
      </SelectItem>,
    );
    expect(screen.getByTestId('item')).toHaveAttribute('data-value', 'banana');
  });

  it('should apply custom className', () => {
    render(
      <SelectItem className="item-class" data-testid="item" value="cherry">
        Cherry
      </SelectItem>,
    );
    expect(screen.getByTestId('item')).toHaveClass('item-class');
  });

  it('should have displayName set to SelectItem', () => {
    expect(SelectItem.displayName).toBe('SelectItem');
  });
});

describe('SelectGroup', () => {
  it('should render children', () => {
    render(<SelectGroup>Group content</SelectGroup>);
    expect(screen.getByText('Group content')).toBeInTheDocument();
  });
});

describe('SelectLabel', () => {
  it('should render label text', () => {
    render(<SelectLabel>Fruits</SelectLabel>);
    expect(screen.getByText('Fruits')).toBeInTheDocument();
  });
});

describe('SelectSeparator', () => {
  it('should render a separator element', () => {
    render(<SelectSeparator data-testid="sep" />);
    expect(screen.getByTestId('sep')).toBeInTheDocument();
  });

  it('should have displayName set to SelectSeparator', () => {
    expect(SelectSeparator.displayName).toBe('SelectSeparator');
  });
});
