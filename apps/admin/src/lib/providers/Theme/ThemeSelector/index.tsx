'use client';

import { IconChevronDown, IconChevronUp, Select } from '@revealui/presentation';
import React, { useState } from 'react';
import { useTheme } from '..';
import type { Theme } from './types';
import { themeLocalStorageKey } from './types';

export const ThemeSelector = () => {
  const { setTheme } = useTheme();
  const [value, setValue] = useState('');

  const onThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeToSet = e.target.value;
    if (themeToSet === 'auto') {
      setTheme(null);
      setValue('auto');
    } else {
      setTheme(themeToSet as Theme);
      setValue(themeToSet);
    }
  };

  React.useEffect(() => {
    const preference = window.localStorage.getItem(themeLocalStorageKey);
    setValue(preference ?? 'auto');
  }, []);

  return (
    <span className="group relative block">
      <Select
        value={value}
        onChange={onThemeChange}
        aria-label="Theme"
        className="relative block w-auto cursor-pointer appearance-none rounded-lg border border-white/10 bg-transparent py-1.5 pr-8 pl-3 text-sm text-white hover:border-white/20 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 *:bg-zinc-800 *:text-white"
      >
        <option value="auto">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex flex-col items-center justify-center pr-2 text-zinc-400">
        <IconChevronUp size="xs" className="size-3" aria-hidden="true" />
        <IconChevronDown size="xs" className="size-3 -mt-0.5" aria-hidden="true" />
      </span>
    </span>
  );
};
