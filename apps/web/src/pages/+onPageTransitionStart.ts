import type { OnPageTransitionStartAsync } from '@revealui/core/types'

export const onPageTransitionStart: OnPageTransitionStartAsync = () => {
  console.log('Page transition start')
  document.querySelector('body')?.classList.add('page-is-transitioning')
}
