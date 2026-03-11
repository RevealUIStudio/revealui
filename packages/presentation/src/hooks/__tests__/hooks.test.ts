import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { createRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClickOutside } from '../use-click-outside';
import { CloseContext, useCloseContext } from '../use-close-context';
import { useDataInteractive } from '../use-data-interactive';
import { useFocusTrap } from '../use-focus-trap';
import { usePopover } from '../use-popover';
import { useRovingTabindex } from '../use-roving-tabindex';
import { useToggle } from '../use-toggle';
import { useTransition } from '../use-transition';
import { useTypeAhead } from '../use-type-ahead';

// ---------------------------------------------------------------------------
// useClickOutside
// ---------------------------------------------------------------------------
describe('useClickOutside', () => {
  let container: HTMLDivElement;
  let outside: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    outside = document.createElement('div');
    document.body.appendChild(container);
    document.body.appendChild(outside);
  });

  afterEach(() => {
    container.remove();
    outside.remove();
  });

  it('calls handler when clicking outside the ref element', () => {
    const handler = vi.fn();
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useClickOutside(ref, handler));

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call handler when clicking inside the ref element', () => {
    const handler = vi.fn();
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useClickOutside(ref, handler));

    container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports an array of refs', () => {
    const handler = vi.fn();
    const secondEl = document.createElement('div');
    document.body.appendChild(secondEl);

    const ref1 = createRef<HTMLElement>();
    const ref2 = createRef<HTMLElement>();
    Object.defineProperty(ref1, 'current', { value: container, writable: true });
    Object.defineProperty(ref2, 'current', { value: secondEl, writable: true });

    renderHook(() => useClickOutside([ref1, ref2], handler));

    // Click inside second ref -- should not fire
    secondEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    // Click outside both
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();

    secondEl.remove();
  });

  it('does not call handler when disabled', () => {
    const handler = vi.fn();
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useClickOutside(ref, handler, false));

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up listener on unmount', () => {
    const handler = vi.fn();
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    const { unmount } = renderHook(() => useClickOutside(ref, handler));
    unmount();

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses latest callback ref without re-attaching listener', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    const { rerender } = renderHook(({ cb }) => useClickOutside(ref, cb), {
      initialProps: { cb: handler1 },
    });

    rerender({ cb: handler2 });

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// useCloseContext
// ---------------------------------------------------------------------------
describe('useCloseContext', () => {
  it('returns null when no provider is present', () => {
    const { result } = renderHook(() => useCloseContext());
    expect(result.current).toBeNull();
  });

  it('returns the close function from the provider', () => {
    const closeFn = vi.fn();
    const { createElement } = require('react');

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CloseContext.Provider, { value: closeFn }, children);

    const { result } = renderHook(() => useCloseContext(), { wrapper });
    expect(result.current).toBe(closeFn);
  });
});

// ---------------------------------------------------------------------------
// useDataInteractive
// ---------------------------------------------------------------------------
describe('useDataInteractive', () => {
  it('returns default state with no data attributes set', () => {
    const { result } = renderHook(() => useDataInteractive());
    expect(result.current['data-hover']).toBeUndefined();
    expect(result.current['data-focus']).toBeUndefined();
    expect(result.current['data-active']).toBeUndefined();
    expect(result.current['data-disabled']).toBeUndefined();
  });

  it('sets data-disabled when disabled', () => {
    const { result } = renderHook(() => useDataInteractive({ disabled: true }));
    expect(result.current['data-disabled']).toBe('');
  });

  it('sets data-hover on pointer enter and clears on pointer leave', () => {
    const { result } = renderHook(() => useDataInteractive());

    act(() => result.current.onPointerEnter());
    expect(result.current['data-hover']).toBe('');

    act(() => result.current.onPointerLeave());
    expect(result.current['data-hover']).toBeUndefined();
  });

  it('does not set data-hover when disabled', () => {
    const { result } = renderHook(() => useDataInteractive({ disabled: true }));

    act(() => result.current.onPointerEnter());
    expect(result.current['data-hover']).toBeUndefined();
  });

  it('sets data-active on pointer down and clears on pointer up', () => {
    const { result } = renderHook(() => useDataInteractive());

    act(() => result.current.onPointerDown());
    expect(result.current['data-active']).toBe('');

    act(() => result.current.onPointerUp());
    expect(result.current['data-active']).toBeUndefined();
  });

  it('does not set data-active when disabled', () => {
    const { result } = renderHook(() => useDataInteractive({ disabled: true }));

    act(() => result.current.onPointerDown());
    expect(result.current['data-active']).toBeUndefined();
  });

  it('clears active state on pointer leave', () => {
    const { result } = renderHook(() => useDataInteractive());

    act(() => result.current.onPointerDown());
    expect(result.current['data-active']).toBe('');

    act(() => result.current.onPointerLeave());
    expect(result.current['data-active']).toBeUndefined();
  });

  it('sets data-focus on focus with :focus-visible and clears on blur', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    // Mock :focus-visible matching
    el.matches = vi.fn(
      (selector: string) => selector === ':focus-visible',
    ) as unknown as typeof el.matches;

    const { result } = renderHook(() => useDataInteractive());

    act(() =>
      result.current.onFocus({
        currentTarget: el,
      } as unknown as React.FocusEvent<HTMLElement>),
    );
    expect(result.current['data-focus']).toBe('');

    act(() => result.current.onBlur());
    expect(result.current['data-focus']).toBeUndefined();

    el.remove();
  });

  it('does not set data-focus when disabled', () => {
    const el = document.createElement('button');
    el.matches = vi.fn(() => true) as unknown as typeof el.matches;

    const { result } = renderHook(() => useDataInteractive({ disabled: true }));

    act(() =>
      result.current.onFocus({
        currentTarget: el,
      } as unknown as React.FocusEvent<HTMLElement>),
    );
    expect(result.current['data-focus']).toBeUndefined();
  });

  it('does not set data-focus if :focus-visible does not match', () => {
    const el = document.createElement('button');
    el.matches = vi.fn(() => false) as unknown as typeof el.matches;

    const { result } = renderHook(() => useDataInteractive());

    act(() =>
      result.current.onFocus({
        currentTarget: el,
      } as unknown as React.FocusEvent<HTMLElement>),
    );
    expect(result.current['data-focus']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useFocusTrap
// ---------------------------------------------------------------------------
describe('useFocusTrap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('focuses the first focusable element on mount', () => {
    const btn1 = document.createElement('button');
    btn1.textContent = 'First';
    const btn2 = document.createElement('button');
    btn2.textContent = 'Second';
    container.appendChild(btn1);
    container.appendChild(btn2);

    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, true));

    expect(document.activeElement).toBe(btn1);
  });

  it('makes container focusable when no focusable children exist', () => {
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, true));

    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(container);
  });

  it('wraps focus from last to first on Tab', () => {
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    container.appendChild(btn1);
    container.appendChild(btn2);
    btn2.focus();

    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, true));

    // Focus should be on btn1 from mount, move to btn2
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Simulate Tab on last element
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(tabEvent, 'shiftKey', { value: false });
    const prevented = vi.fn();
    Object.defineProperty(tabEvent, 'preventDefault', { value: prevented });

    document.dispatchEvent(tabEvent);
    expect(prevented).toHaveBeenCalled();
    expect(document.activeElement).toBe(btn1);
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    container.appendChild(btn1);
    container.appendChild(btn2);

    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, true));

    // Focus is on btn1 from mount
    expect(document.activeElement).toBe(btn1);

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(tabEvent, 'shiftKey', { value: true });
    const prevented = vi.fn();
    Object.defineProperty(tabEvent, 'preventDefault', { value: prevented });

    document.dispatchEvent(tabEvent);
    expect(prevented).toHaveBeenCalled();
    expect(document.activeElement).toBe(btn2);
  });

  it('does not trap focus when disabled', () => {
    const btn1 = document.createElement('button');
    container.appendChild(btn1);

    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, false));

    // Should NOT auto-focus
    expect(document.activeElement).not.toBe(btn1);
  });

  it('restores focus on unmount', () => {
    const externalBtn = document.createElement('button');
    document.body.appendChild(externalBtn);
    externalBtn.focus();
    expect(document.activeElement).toBe(externalBtn);

    const btn1 = document.createElement('button');
    container.appendChild(btn1);

    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    const { unmount } = renderHook(() => useFocusTrap(ref, true));

    // Focus moved to btn1
    expect(document.activeElement).toBe(btn1);

    unmount();

    // Focus restored to externalBtn
    expect(document.activeElement).toBe(externalBtn);

    externalBtn.remove();
  });

  it('prevents Tab when container has no focusable elements', () => {
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    renderHook(() => useFocusTrap(ref, true));

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const prevented = vi.fn();
    Object.defineProperty(tabEvent, 'preventDefault', { value: prevented });

    document.dispatchEvent(tabEvent);
    expect(prevented).toHaveBeenCalled();
  });

  it('does nothing when ref is null', () => {
    const ref = createRef<HTMLElement>();
    // ref.current is null by default

    // Should not throw
    renderHook(() => useFocusTrap(ref, true));
  });
});

// ---------------------------------------------------------------------------
// usePopover
// ---------------------------------------------------------------------------
describe('usePopover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame to run synchronously
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns initial position when closed', () => {
    const { result } = renderHook(() => usePopover({ open: false }));
    expect(result.current.position).toEqual({ top: 0, left: 0, maxHeight: 300 });
    expect(result.current.popoverProps.style.position).toBe('fixed');
    expect(result.current.popoverProps.style.zIndex).toBe(50);
  });

  it('returns refs for trigger and popover', () => {
    const { result } = renderHook(() => usePopover({ open: false }));
    expect(result.current.triggerRef).toBeDefined();
    expect(result.current.popoverRef).toBeDefined();
  });

  it('updates position when open becomes true and refs are attached', () => {
    const trigger = document.createElement('button');
    const popover = document.createElement('div');
    document.body.appendChild(trigger);
    document.body.appendChild(popover);

    // Mock getBoundingClientRect
    trigger.getBoundingClientRect = () => ({
      top: 100,
      bottom: 130,
      left: 50,
      right: 150,
      width: 100,
      height: 30,
      x: 50,
      y: 100,
      toJSON: () => {},
    });
    popover.getBoundingClientRect = () => ({
      top: 0,
      bottom: 200,
      left: 0,
      right: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const { result, rerender } = renderHook(
      ({ open }) => {
        const rv = usePopover({ open, anchor: 'bottom', gap: 8, padding: 4 });
        // Attach refs
        Object.defineProperty(rv.triggerRef, 'current', {
          value: trigger,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(rv.popoverRef, 'current', {
          value: popover,
          writable: true,
          configurable: true,
        });
        return rv;
      },
      { initialProps: { open: false } },
    );

    rerender({ open: true });

    // Position should have been computed
    expect(result.current.position.top).toBeGreaterThanOrEqual(0);

    trigger.remove();
    popover.remove();
  });

  it('cleans up scroll/resize listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => usePopover({ open: true }));
    unmount();

    const removeCalls = removeSpy.mock.calls.map((c) => c[0]);
    expect(removeCalls).toContain('resize');
    expect(removeCalls).toContain('scroll');
  });
});

// ---------------------------------------------------------------------------
// useRovingTabindex
// ---------------------------------------------------------------------------
describe('useRovingTabindex', () => {
  it('returns initial activeIndex of -1 by default', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3 }));
    expect(result.current.activeIndex).toBe(-1);
  });

  it('returns custom initialIndex', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 1 }));
    expect(result.current.activeIndex).toBe(1);
  });

  it('container role is listbox for vertical orientation', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, orientation: 'vertical' }),
    );
    expect(result.current.containerProps.role).toBe('listbox');
  });

  it('container role is group for horizontal orientation', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, orientation: 'horizontal' }),
    );
    expect(result.current.containerProps.role).toBe('group');
  });

  it('getItemProps returns correct tabIndex for active/inactive items', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 1 }));

    expect(result.current.getItemProps(0).tabIndex).toBe(-1);
    expect(result.current.getItemProps(1).tabIndex).toBe(0);
    expect(result.current.getItemProps(2).tabIndex).toBe(-1);
  });

  it('getItemProps returns data-focus for active item', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 1 }));

    expect(result.current.getItemProps(0)['data-focus']).toBeUndefined();
    expect(result.current.getItemProps(1)['data-focus']).toBe('');
  });

  it('setActiveIndex updates the active item', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 0 }));

    act(() => result.current.setActiveIndex(2));
    expect(result.current.activeIndex).toBe(2);
  });

  it('calls onActiveChange when active index changes', () => {
    const onActiveChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 0, onActiveChange }),
    );

    act(() => result.current.setActiveIndex(2));
    expect(onActiveChange).toHaveBeenCalledWith(2);
  });

  it('moves focus down on ArrowDown (vertical)', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 0, orientation: 'vertical' }),
    );

    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.activeIndex).toBe(1);
  });

  it('moves focus up on ArrowUp (vertical)', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 1, orientation: 'vertical' }),
    );

    const event = {
      key: 'ArrowUp',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(0);
  });

  it('moves focus right on ArrowRight (horizontal)', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 0, orientation: 'horizontal' }),
    );

    const event = {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(1);
  });

  it('moves focus left on ArrowLeft (horizontal)', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 1, orientation: 'horizontal' }),
    );

    const event = {
      key: 'ArrowLeft',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(0);
  });

  it('wraps around from last to first with loop enabled', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 2, loop: true }),
    );

    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(0);
  });

  it('wraps around from first to last with loop enabled', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 0, loop: true }),
    );

    const event = {
      key: 'ArrowUp',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(2);
  });

  it('clamps at boundaries without loop', () => {
    const { result } = renderHook(() =>
      useRovingTabindex({ itemCount: 3, initialIndex: 2, loop: false }),
    );

    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(2);
  });

  it('Home key moves to first item', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 2 }));

    const event = {
      key: 'Home',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(0);
  });

  it('End key moves to last item', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 0 }));

    const event = {
      key: 'End',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(2);
  });

  it('onPointerEnter on item sets active index', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 0 }));

    act(() => result.current.getItemProps(2).onPointerEnter());
    expect(result.current.activeIndex).toBe(2);
  });

  it('onClick on item sets active index', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 0 }));

    act(() => result.current.getItemProps(1).onClick());
    expect(result.current.activeIndex).toBe(1);
  });

  it('ref callback registers and unregisters items', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 2, initialIndex: 0 }));

    const el = document.createElement('div');

    // Register
    act(() => result.current.getItemProps(0).ref(el));
    // Unregister
    act(() => result.current.getItemProps(0).ref(null));

    // No error should occur
  });

  it('does nothing on arrow key when itemCount is 0', () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 0, initialIndex: -1 }));

    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.containerProps.onKeyDown(event));
    expect(result.current.activeIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// useToggle
// ---------------------------------------------------------------------------
describe('useToggle', () => {
  it('defaults to unchecked', () => {
    const { result } = renderHook(() => useToggle());
    expect(result.current.checked).toBe(false);
    expect(result.current.toggleProps['aria-checked']).toBe(false);
    expect(result.current.toggleProps['data-checked']).toBeUndefined();
  });

  it('respects defaultChecked', () => {
    const { result } = renderHook(() => useToggle({ defaultChecked: true }));
    expect(result.current.checked).toBe(true);
    expect(result.current.toggleProps['data-checked']).toBe('');
  });

  it('toggles on toggle() call', () => {
    const { result } = renderHook(() => useToggle());

    act(() => result.current.toggle());
    expect(result.current.checked).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.checked).toBe(false);
  });

  it('toggles on click via toggleProps', () => {
    const { result } = renderHook(() => useToggle());

    act(() => result.current.toggleProps.onClick());
    expect(result.current.checked).toBe(true);
  });

  it('toggles on Space key via toggleProps', () => {
    const { result } = renderHook(() => useToggle());

    const event = {
      key: ' ',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.toggleProps.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.checked).toBe(true);
  });

  it('does not toggle on other keys', () => {
    const { result } = renderHook(() => useToggle());

    const event = {
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => result.current.toggleProps.onKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(result.current.checked).toBe(false);
  });

  it('does not toggle when disabled', () => {
    const { result } = renderHook(() => useToggle({ disabled: true }));

    act(() => result.current.toggle());
    expect(result.current.checked).toBe(false);
  });

  it('calls onChange callback', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useToggle({ onChange }));

    act(() => result.current.toggle());
    expect(onChange).toHaveBeenCalledWith(true);

    act(() => result.current.toggle());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('works in controlled mode', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ checked }) => useToggle({ checked, onChange }), {
      initialProps: { checked: false },
    });

    expect(result.current.checked).toBe(false);

    act(() => result.current.toggle());
    // Controlled: onChange is called but internal state not changed
    expect(onChange).toHaveBeenCalledWith(true);
    // Still false because controlled value is false
    expect(result.current.checked).toBe(false);

    // Parent re-renders with new value
    rerender({ checked: true });
    expect(result.current.checked).toBe(true);
  });

  it('toggleProps.tabIndex is 0', () => {
    const { result } = renderHook(() => useToggle());
    expect(result.current.toggleProps.tabIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useTransition
// ---------------------------------------------------------------------------
describe('useTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = setTimeout(() => cb(0), 0);
      return id as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts hidden when show is false', () => {
    const { result } = renderHook(() => useTransition(false));
    expect(result.current.mounted).toBe(false);
    expect(result.current.transitionProps['data-closed']).toBe('');
  });

  it('starts visible when show is true', () => {
    const { result } = renderHook(() => useTransition(true));
    expect(result.current.mounted).toBe(true);
    expect(result.current.transitionProps['data-closed']).toBeUndefined();
    expect(result.current.transitionProps['data-enter']).toBeUndefined();
    expect(result.current.transitionProps['data-leave']).toBeUndefined();
  });

  it('enters enter-from phase when show changes false->true', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: false },
    });

    rerender({ show: true });

    // Should be in enter-from: mounted, data-closed, data-enter set
    expect(result.current.mounted).toBe(true);
    expect(result.current.transitionProps['data-closed']).toBe('');
    expect(result.current.transitionProps['data-enter']).toBe('');
    expect(result.current.transitionProps['data-transition']).toBe('');
  });

  it('completes enter sequence and reaches visible via fallback timeout', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: false },
    });

    rerender({ show: true });

    // In enter-from phase initially
    expect(result.current.mounted).toBe(true);
    expect(result.current.transitionProps['data-enter']).toBe('');

    // Advance all timers to complete the double rAF + fallback timeout
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should have reached visible phase
    expect(result.current.mounted).toBe(true);
    expect(result.current.transitionProps['data-enter']).toBeUndefined();
    expect(result.current.transitionProps['data-transition']).toBeUndefined();
    expect(result.current.transitionProps['data-closed']).toBeUndefined();
  });

  it('enters leave phase when show changes true->false', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: true },
    });

    // Attach a node for transitionend
    const node = document.createElement('div');
    Object.defineProperty(result.current.nodeRef, 'current', {
      value: node,
      writable: true,
      configurable: true,
    });

    rerender({ show: false });

    expect(result.current.mounted).toBe(true);
    expect(result.current.transitionProps['data-closed']).toBe('');
    expect(result.current.transitionProps['data-leave']).toBe('');
    expect(result.current.transitionProps['data-transition']).toBe('');
  });

  it('unmounts after leave transition completes via fallback timeout', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: true },
    });

    const node = document.createElement('div');
    Object.defineProperty(result.current.nodeRef, 'current', {
      value: node,
      writable: true,
      configurable: true,
    });

    rerender({ show: false });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.mounted).toBe(false);
  });

  it('unmounts after leave transition completes via transitionend event', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: true },
    });

    const node = document.createElement('div');
    Object.defineProperty(result.current.nodeRef, 'current', {
      value: node,
      writable: true,
      configurable: true,
    });

    rerender({ show: false });

    // Fire transitionend
    act(() => {
      node.dispatchEvent(new Event('transitionend'));
    });

    expect(result.current.mounted).toBe(false);
  });

  it('immediately hides when no nodeRef on leave', () => {
    const { result, rerender } = renderHook(({ show }) => useTransition(show), {
      initialProps: { show: true },
    });

    // nodeRef.current is null (no node attached)
    rerender({ show: false });

    expect(result.current.mounted).toBe(false);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useTransition(true));
    // Should not throw
    unmount();
  });
});

// ---------------------------------------------------------------------------
// useTypeAhead
// ---------------------------------------------------------------------------
describe('useTypeAhead', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const items = ['Apple', 'Banana', 'Cherry', 'Date'];
  const getItemText = (i: number) => items[i] ?? '';

  it('matches the first item starting with typed character', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    const event = {
      key: 'b',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    } as unknown as React.KeyboardEvent;

    act(() => result.current.onKeyDown(event));
    expect(onMatch).toHaveBeenCalledWith(1);
  });

  it('accumulates characters for multi-char search', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    const mkEvent = (key: string) =>
      ({ key, ctrlKey: false, metaKey: false, altKey: false }) as unknown as React.KeyboardEvent;

    act(() => result.current.onKeyDown(mkEvent('c')));
    expect(onMatch).toHaveBeenCalledWith(2); // Cherry

    act(() => result.current.onKeyDown(mkEvent('h')));
    // "ch" still matches Cherry
    expect(onMatch).toHaveBeenCalledTimes(2);
    expect(onMatch).toHaveBeenLastCalledWith(2);
  });

  it('resets search buffer after timeout', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch, timeout: 350 }),
    );

    const mkEvent = (key: string) =>
      ({ key, ctrlKey: false, metaKey: false, altKey: false }) as unknown as React.KeyboardEvent;

    act(() => result.current.onKeyDown(mkEvent('c')));
    expect(onMatch).toHaveBeenCalledWith(2);

    // Advance past timeout
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Now typing 'a' should match Apple (index 0), not "ca"
    act(() => result.current.onKeyDown(mkEvent('a')));
    expect(onMatch).toHaveBeenLastCalledWith(0);
  });

  it('ignores special keys (Ctrl, Meta, Alt combinations)', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    act(() =>
      result.current.onKeyDown({
        key: 'a',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent),
    );

    expect(onMatch).not.toHaveBeenCalled();
  });

  it('ignores multi-character keys like Enter or Escape', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    act(() =>
      result.current.onKeyDown({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent),
    );

    expect(onMatch).not.toHaveBeenCalled();
  });

  it('does not call onMatch when no item matches', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    act(() =>
      result.current.onKeyDown({
        key: 'z',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent),
    );

    expect(onMatch).not.toHaveBeenCalled();
  });

  it('is case-insensitive', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch }),
    );

    act(() =>
      result.current.onKeyDown({
        key: 'B',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent),
    );

    expect(onMatch).toHaveBeenCalledWith(1); // Banana
  });

  it('handles zero items without error', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText: () => '', itemCount: 0, onMatch }),
    );

    act(() =>
      result.current.onKeyDown({
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent),
    );

    expect(onMatch).not.toHaveBeenCalled();
  });

  it('uses custom timeout value', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useTypeAhead({ getItemText, itemCount: items.length, onMatch, timeout: 100 }),
    );

    const mkEvent = (key: string) =>
      ({ key, ctrlKey: false, metaKey: false, altKey: false }) as unknown as React.KeyboardEvent;

    act(() => result.current.onKeyDown(mkEvent('c')));

    // At 100ms, buffer should be cleared
    act(() => {
      vi.advanceTimersByTime(150);
    });

    act(() => result.current.onKeyDown(mkEvent('a')));
    expect(onMatch).toHaveBeenLastCalledWith(0); // Apple, not "ca"
  });
});
