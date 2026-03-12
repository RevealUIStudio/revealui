'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/lib/components/index';
import { useHeaderTheme } from '@/lib/providers/HeaderTheme/index';
import type { HeaderType } from './Component';
// import { Logo } from "../../components/Logo/Logo";
import { HeaderNav } from './Nav/index';

interface HeaderClientProps {
  header: HeaderType;
}

export const HeaderClient = ({ header }: HeaderClientProps) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null);
  const { headerTheme, setHeaderTheme } = useHeaderTheme();

  useEffect(() => {
    setHeaderTheme(null);
  }, [setHeaderTheme]);

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme);
  }, [headerTheme, theme]);

  return (
    <header
      className="container relative z-20 py-8 flex justify-between"
      {...(theme ? { 'data-theme': theme } : {})}
    >
      <Link href="/">
        <Logo />
      </Link>
      <HeaderNav header={header} />
    </header>
  );
};
