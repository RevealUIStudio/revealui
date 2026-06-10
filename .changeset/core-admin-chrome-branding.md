---
'@revealui/core': patch
---

White-label the admin engine chrome: `RootLayout`'s document title, `RootPage`'s header, and `generatePageMetadata` now resolve the brand from `REVEALUI_BRAND_NAME` / `REVEALUI_TENANT_NAME` server-side (empty strings treated as unset), and `AdminDashboard` accepts an optional `siteName` prop for its top-bar heading and status copy. Hosted deployments without overrides keep the canonical "RevealUI Admin" everywhere.
