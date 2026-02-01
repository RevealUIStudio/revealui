'use client'

import type React from 'react'
import { CMSLink } from '../../../components/Link/index.js'
import type { HeaderType } from '../Component.js'

export const HeaderNav: React.FC<{ header: HeaderType }> = ({ header }) => {
  const navItems = header?.navItems || []

  const getNavItemKey = (item: NonNullable<HeaderType['navItems']>[number]) => {
    if (item.id) return item.id

    const referenceValue = item.link?.reference?.value
    if (typeof referenceValue === 'string' || typeof referenceValue === 'number') {
      return referenceValue
    }

    if (referenceValue && typeof referenceValue === 'object' && 'id' in referenceValue) {
      return referenceValue.id
    }

    return item.link?.url ?? item.link?.label ?? 'nav-item'
  }

  return (
    <nav className="flex gap-3 items-center">
      {navItems.map((item) => {
        return <CMSLink key={getNavItemKey(item)} {...item.link} appearance="link" />
      })}
    </nav>
  )
}
