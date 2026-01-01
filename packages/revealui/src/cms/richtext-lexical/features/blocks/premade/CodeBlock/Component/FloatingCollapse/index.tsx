import React from 'react'

import './index.scss'

const baseClass = 'code-block-floating-collapse-button'
import { useCollapsible, useTranslation } from '../../ui/index.js'

import { CollapseIcon } from '../../../../lexical/packages/lexical/ui/icons/Collapse/index.js'

export const FloatingCollapse: React.FC = () => {
  const { isCollapsed, toggle } = useCollapsible()
  const { t } = useTranslation()

  if (!isCollapsed) {
    return null
  }

  return (
    <button className={baseClass} onClick={toggle} type="button">
      <span>{t('general:collapse')}</span>
      <CollapseIcon />
    </button>
  )
}
