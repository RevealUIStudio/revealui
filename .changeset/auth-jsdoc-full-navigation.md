---
"@revealui/auth": patch
---

docs(auth): post-auth hook examples now use a full document navigation instead of router.push(). In the Next.js App Router, a soft navigation after the session cookie changes replays the pre-auth client Router Cache (the logged-out RSC payload) and bounces the user back to the login page. The useSignIn, useSignUp, useMFAVerify, and usePasskeySignIn examples now use window.location.href, matching useSignOut and the admin auth forms. Doc comments only, no runtime change.
