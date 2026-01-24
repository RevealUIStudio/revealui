import type { OnPageTransitionEndAsync } from '@revealui/core/types'
import { logger } from '@revealui/core/utils/logger'

export const onPageTransitionEnd: OnPageTransitionEndAsync = () => {
  logger.debug('Page transition end')
  document.querySelector('body')?.classList.remove('page-is-transitioning')
}
