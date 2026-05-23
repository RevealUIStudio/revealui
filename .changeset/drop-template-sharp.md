---
"@revealui/cli": patch
---

Project templates no longer pass an unused `sharp` instance to `buildConfig`.
The RevealUI engine does not decode images in-process (resizing is delegated to
`next/image`), so the injection was a no-op. `sharp` remains available for
Next.js image optimization in generated projects.
