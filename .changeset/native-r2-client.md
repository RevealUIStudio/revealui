---
"@revealui/core": minor
---

Replace the `@aws-sdk/client-s3` dependency with a native, dependency-free Cloudflare R2 storage client. The R2 `StorageProvider` now signs requests with AWS Signature V4 (`node:crypto`) over global `fetch` and reads `ListObjectsV2`/error responses with a small no-regex XML parser, instead of routing through the AWS SDK. The provider contract and all behavior are unchanged; this drops the entire `@aws-sdk` / `@aws-crypto` / `@smithy` transitive dependency tree.
