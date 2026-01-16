import type { OnPageTransitionEndAsync } from '@revealui/core/types'

export const onPageTransitionEnd: OnPageTransitionEndAsync = () => {
  console.log('Page transition end')
  document.querySelector('body')?.classList.remove('page-is-transitioning')
}
