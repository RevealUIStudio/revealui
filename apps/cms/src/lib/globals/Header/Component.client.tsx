'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Logo } from '../../components/index'
import { useHeaderTheme } from '../../providers/HeaderTheme/index'
import type { HeaderType } from './Component'
// import { Logo } from "../../components/Logo/Logo";
import { HeaderNav } from './Nav/index'

interface HeaderClientProps {
  header: HeaderType
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ header }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const _pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderTheme])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme, theme])

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
  )
}
