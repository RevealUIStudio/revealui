# @revealui/knowledge-graph

## 0.1.12

### Patch Changes

- ee58150: Extract `assembleContext` into `@revealui/knowledge-graph` so product `kg_context` and the RevDev bridge share the MIT helper. `/memory` remains part of this package for the next publish.
- 8486734: Add `@revealui/knowledge-graph/memory`: product memory helpers and a result envelope. Durable findings compose existing episode ingest; daemon working memory is unchanged.
- 975d3c7: Scope product memory reads in SQL before LIMIT. Hosted non-operators see the memory subgraph only; deny is distinct from empty; graph walks do not hop invisible edges.

## 0.1.11

## 0.1.10

### Patch Changes

- 64d9048: Safe fleet scan (dry-run default, CI refuse --publish) and graph.\* replica pull/apply/push.

## 0.1.9

### Patch Changes

- Add revkg decommission for retired repository edges (GAP-349 residual).

## 0.1.8

## 0.1.7

## 0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [fb3315c]
- Updated dependencies [94d1714]
  - @revealui/db@0.10.0

## 0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [c3c1e8f]
- Updated dependencies [1385cd6]
- Updated dependencies [077d3c4]
- Updated dependencies [578214d]
  - @revealui/db@0.9.0

## 0.1.2

### Patch Changes

- Updated dependencies [eac1a1b]
- Updated dependencies [76efd75]
  - @revealui/db@0.8.0

## 0.1.1

### Patch Changes

- @revealui/db@0.7.3
