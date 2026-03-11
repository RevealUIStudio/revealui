import { useCallback } from 'react';
import { useControllableState } from './use-controllable-state.js';

interface UseToggleOptions {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

interface UseToggleReturn {
  checked: boolean;
  toggle: () => void;
  toggleProps: {
    'aria-checked': boolean;
    'data-checked': string | undefined;
    tabIndex: number;
    onClick: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
}

export function useToggle({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
}: UseToggleOptions = {}): UseToggleReturn {
  const [checked, setChecked] = useControllableState({
    value: controlledChecked,
    defaultValue: defaultChecked,
    onChange,
  });

  const toggle = useCallback(() => {
    if (!disabled) {
      setChecked((prev) => !prev);
    }
  }, [disabled, setChecked]);

  const onClick = useCallback(() => {
    toggle();
  }, [toggle]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return {
    checked,
    toggle,
    toggleProps: {
      'aria-checked': checked,
      'data-checked': checked ? '' : undefined,
      tabIndex: 0,
      onClick,
      onKeyDown,
    },
  };
}
