---
'@revealui/editor': patch
---

Land canvas defaults for a fresh edit session: resolve a published page (`home` then `products` then first) when no dirty docs exist, so the preview iframe is not stuck on bare `/`. Export `pickDefaultPreviewPageId` for the preference order.
