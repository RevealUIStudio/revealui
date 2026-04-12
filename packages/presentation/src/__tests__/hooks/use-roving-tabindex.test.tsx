import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useRovingTabindex } from '../../hooks/use-roving-tabindex.js';

function ListboxComponent({
  itemCount = 3,
  initialIndex = -1,
  loop = true,
  orientation = 'vertical' as const,
  onActiveChange,
}: {
  itemCount?: number;
  initialIndex?: number;
  loop?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onActiveChange?: (index: number) => void;
}) {
  const { activeIndex, containerProps, getItemProps } = useRovingTabindex({
    itemCount,
    initialIndex,
    orientation,
    loop,
    onActiveChange,
  });

  return (
    <div {...containerProps} data-testid="container">
      {Array.from({ length: itemCount }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: test fixture items are positionally ordered with no stable ID
        <div key={`item-${i}`} {...getItemProps(i)} data-testid={`item-${i}`}>
          Item {i}
        </div>
      ))}
      <span data-testid="active-index">{activeIndex}</span>
    </div>
  );
}

describe('useRovingTabindex', () => {
  describe('initial state', () => {
    it('should start with no active item by default', () => {
      render(<ListboxComponent />);
      expect(screen.getByTestId('active-index')).toHaveTextContent('-1');
    });

    it('should start with specified initialIndex', () => {
      render(<ListboxComponent initialIndex={1} />);
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });
  });

  describe('keyboard navigation (vertical)', () => {
    it('should move down on ArrowDown', () => {
      render(<ListboxComponent initialIndex={0} />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });

    it('should move up on ArrowUp', () => {
      render(<ListboxComponent initialIndex={1} />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('should wrap from last to first when looping', () => {
      render(<ListboxComponent initialIndex={2} loop />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('should wrap from first to last when looping', () => {
      render(<ListboxComponent initialIndex={0} loop />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });

    it('should clamp at boundaries when not looping', () => {
      render(<ListboxComponent initialIndex={2} loop={false} />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });

    it('should go to first on Home', () => {
      render(<ListboxComponent initialIndex={2} />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'Home' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('should go to last on End', () => {
      render(<ListboxComponent initialIndex={0} />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'End' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });
  });

  describe('horizontal orientation', () => {
    it('should use ArrowRight/ArrowLeft instead of Down/Up', () => {
      render(<ListboxComponent initialIndex={0} orientation="horizontal" />);
      const container = screen.getByTestId('container');

      fireEvent.keyDown(container, { key: 'ArrowRight' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('1');

      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });
  });

  describe('item props', () => {
    it('should set tabIndex 0 on active item and -1 on others', () => {
      render(<ListboxComponent initialIndex={1} />);

      expect(screen.getByTestId('item-0')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('item-1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('item-2')).toHaveAttribute('tabindex', '-1');
    });

    it('should set data-focus on active item', () => {
      render(<ListboxComponent initialIndex={1} />);

      expect(screen.getByTestId('item-0')).not.toHaveAttribute('data-focus');
      expect(screen.getByTestId('item-1')).toHaveAttribute('data-focus', '');
      expect(screen.getByTestId('item-2')).not.toHaveAttribute('data-focus');
    });

    it('should activate on pointer enter', () => {
      render(<ListboxComponent initialIndex={0} />);

      // Use fireEvent directly  -  userEvent.hover() has timing issues in JSDOM
      // that cause intermittent timeouts with onPointerEnter handlers
      fireEvent.pointerEnter(screen.getByTestId('item-2'));
      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });

    it('should activate on click', async () => {
      const user = userEvent.setup();
      render(<ListboxComponent initialIndex={0} />);

      await user.click(screen.getByTestId('item-2'));
      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });
  });

  describe('callbacks', () => {
    it('should call onActiveChange when index changes', () => {
      const onActiveChange = vi.fn();
      render(<ListboxComponent initialIndex={0} onActiveChange={onActiveChange} />);

      const container = screen.getByTestId('container');
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(onActiveChange).toHaveBeenCalledWith(1);
    });
  });

  describe('container props', () => {
    it('should have role listbox for vertical orientation', () => {
      render(<ListboxComponent orientation="vertical" />);
      expect(screen.getByTestId('container')).toHaveAttribute('role', 'listbox');
    });

    it('should have role group for horizontal orientation', () => {
      render(<ListboxComponent orientation="horizontal" />);
      expect(screen.getByTestId('container')).toHaveAttribute('role', 'group');
    });
  });
});
