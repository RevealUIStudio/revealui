'use client';

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
      <select
        value={value}
        onChange={onThemeChange}
        aria-label="Theme"
        className="relative block w-auto cursor-pointer appearance-none rounded-lg border border-white/10 bg-transparent py-1.5 pr-8 pl-3 text-sm text-white hover:border-white/20 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 *:bg-zinc-800 *:text-white"
      >
        <option value="auto">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg className="size-4 stroke-zinc-400" viewBox="0 0 16 16" aria-hidden="true" fill="none">
          <path
            d="M5.75 10.75L8 13L10.25 10.75"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.25 5.25L8 3L5.75 5.25"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
};
