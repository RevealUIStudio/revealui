---
'@revealui/presentation': patch
'@revealui/router': patch
---

Fix mobile navigation on touch devices and add router scroll handling.

presentation: add `relative` to the CVA button base so `LinkButton`'s
`TouchTarget` hit-area expander (and the `ShineOverlay`) stay contained. Without
a positioned ancestor on the button itself, the coarse-pointer touch-target
overlay sized against the nearest positioned ancestor (such as a `sticky`
header) and blanketed surrounding controls, intercepting taps. That is what
stopped the marketing mobile hamburger (a sibling of the signup `LinkButton`)
from opening on phones.

router: `navigate()` now scrolls to the top on hashless client navigations
(anchor links with a `#` are left alone), and `initClient()` sets
`history.scrollRestoration = 'auto'` explicitly so the browser keeps restoring
scroll on back/forward and reload. The global click handler now bails when
`event.defaultPrevented` is already set, so it defers to the React `<Link>`
component instead of pushing a duplicate history entry.
