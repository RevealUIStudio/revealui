# Developer Experience Cohesion Analysis

> Generated: 2026-02-17T16:56:51.379Z
> Grade: **C**
> Issues: 5 total

## Executive Summary

The codebase has **5** cohesion issues: 1 high, 1 medium, 3 low.

Overall grade: **C**

**1 high-priority issues** should be addressed this sprint.

## Issue Breakdown

### 🟠 Direct path import workaround (../../packages/)

- **Severity:** HIGH
- **Impact:** Breaks module boundaries, fragile to refactoring
- **Count:** 8 instances
- **Description:** Found 8 instances of Direct path import workaround (../../packages/) across 2 files.

**Evidence:**

- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/index.ts:341`
  ```ts
  // // import { CallToAction } from "../../../../../packages/utils/src/blocks/CallToAction";
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/index.ts:342`
  ```ts
  // // import { Content } from "../../../../../packages/utils/src/blocks/Content";
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/index.ts:343`
  ```ts
  // // import { MediaBlock } from "../../../../../packages/utils/src/blocks/MediaBlock";
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/index.ts:344`
  ```ts
  // // // import { slugField } from "../../../../../packages/utils/src/fields/slug";
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Products/index.ts:162`
  ```ts
  // import { CallToAction } from "../../../../../packages/utils/src/blocks/CallToAction";
  ```
- ... and 3 more

**Recommendation:** Consider extracting this pattern into a shared utility or fixing the root cause.

### 🟡 Duplicate getRevealUI({ config }) calls

- **Severity:** MEDIUM
- **Impact:** Inefficient initialization, potential state issues
- **Count:** 10 instances
- **Description:** Found 10 instances of Duplicate getRevealUI({ config }) calls across 10 files.

**Evidence:**

- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(backend)/api/[...slug]/route.ts:19`
  ```ts
  revealInstance = await getRevealUI({ config })
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/[slug]/page.tsx:86`
  ```ts
  const revealui = await getRevealUI({ config })
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/next/preview/route.ts:14`
  ```ts
  const revealui = await getRevealUI({ config })
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/posts/[slug]/page.tsx:77`
  ```ts
  const revealui = await getRevealUI({ config })
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/posts/page/[pageNumber]/page.tsx:15`
  ```ts
  const revealui = await getRevealUI({ config })
  ```
- ... and 5 more

**Recommendation:** Consider extracting this pattern into a shared utility or fixing the root cause.

### 🟢 Type assertion using "as unknown"

- **Severity:** LOW
- **Impact:** Reduced type safety, may hide type errors
- **Count:** 102 instances
- **Description:** Found 102 instances of Type assertion using "as unknown" across 47 files.

**Evidence:**

- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/[slug]/page.tsx:43`
  ```ts
  <RenderBlocks blocks={layout as unknown as PageType['layout']} />
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/posts/[slug]/page.tsx:29`
  ```ts
  const post = result as unknown as Post
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/posts/page/[pageNumber]/page.tsx:41`
  ```ts
  <CollectionArchive posts={posts.docs as unknown as Post[]} />
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(frontend)/posts/page.tsx:39`
  ```ts
  <CollectionArchive posts={posts.docs as unknown as Post[]} />
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/api/memory/episodic/[userId]/[memoryId]/route.ts:165`
  ```ts
  const memoryInstance = memory as unknown as {
  ```
- ... and 5 more

**Recommendation:** Consider extracting this pattern into a shared utility or fixing the root cause.

### 🟢 Console.log statements (should use logger)

- **Severity:** LOW
- **Impact:** Inconsistent logging, harder to control output
- **Count:** 26 instances
- **Description:** Found 26 instances of Console.log statements (should use logger) across 11 files.

**Evidence:**

- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/blocks/types.ts:28`
  ```ts
  *   console.log(unknownValue.type)
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/examples/populate-examples.ts:67`
  ```ts
  console.log(`Fetched ${result.docs.length} prices (IDs only)`)
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/examples/populate-examples.ts:76`
  ```ts
  console.log('Populated price:', populated)
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/ui/PricesSelect.tsx:105`
  ```ts
  //   console.log("name", name);
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Products/examples/populate-examples.ts:38`
  ```ts
  * console.log(product.categories[0].name) // 'Electronics'
  ```
- ... and 5 more

**Recommendation:** Consider extracting this pattern into a shared utility or fixing the root cause.

### 🟢 TODO comments in code

- **Severity:** LOW
- **Impact:** Technical debt marker, may indicate incomplete work
- **Count:** 23 instances
- **Description:** Found 23 instances of TODO comments in code across 8 files.

**Evidence:**

- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(backend)/admin/[[...segments]]/page.tsx:31`
  ```ts
  // // TODO: Implement local alternative
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/app/(backend)/layout.tsx:7`
  ```ts
  // TODO: Implement local CSS
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/ui/PricesSelect.tsx:91`
  ```ts
  // // TODO: Implement local UI components
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Prices/ui/PricesSelect.tsx:92`
  ```ts
  // TODO: Implement local alternative
  ```
- `/home/joshua-v-dev/projects/RevealUI/apps/cms/src/lib/collections/Products/ui/ProductSelect.tsx:87`
  ```ts
  // // TODO: Implement local UI components
  ```
- ... and 5 more

**Recommendation:** Consider extracting this pattern into a shared utility or fixing the root cause.


## Metrics

| Metric | Value |
|--------|-------|
| Total Issues | 169 |
| Critical Issues | 0 (0.0%) |
| High Priority Issues | 8 (4.7%) |
| Medium Priority Issues | 10 (5.9%) |
| Low Priority Issues | 151 (89.3%) |
| Pattern Types Found | 5 |
| Files Affected | 66 |

## Recommendations

### This Sprint (High Priority)
1. **Direct path import workaround (../../packages/)** — Consider extracting this pattern into a shared utility or fixing the root cause.

### Backlog (Medium/Low)
2. **Duplicate getRevealUI({ config }) calls** — Consider extracting this pattern into a shared utility or fixing the root cause.
3. **Type assertion using "as unknown"** — Consider extracting this pattern into a shared utility or fixing the root cause.
4. **Console.log statements (should use logger)** — Consider extracting this pattern into a shared utility or fixing the root cause.
5. **TODO comments in code** — Consider extracting this pattern into a shared utility or fixing the root cause.

## Action Items

| # | Action | Severity | Automated Fix? |
|---|--------|----------|----------------|
| 1 | Duplicate getRevealUI({ config }) calls | MEDIUM | No |
| 2 | Type assertion using "as unknown" | LOW | No |
| 3 | Direct path import workaround (../../packages/) | HIGH | No |
| 4 | Console.log statements (should use logger) | LOW | Yes |
| 5 | TODO comments in code | LOW | No |