# @revealui/claim-gates

## 0.2.0

### Minor Changes

- 45133b2: Add the model-artifact C-SCRM door (URL plus sha256, refuse pickle-class formats) and claim-gates holds that block C-SCRM, trustworthy-AI, AML-hardened, and weight-scan product claims.

### Patch Changes

- 4981dce: Keep Enterprise SSO/SAML copy-dependent holds waiting until #449 closes, and treat unqualified "in code" / pricing-table claims as live copy.
- 2687f01: Match markdown table `Label | N` inventory claims (and heading `Apps (N)` forms) against live monorepo metrics so the honesty ledger cannot drift from `site.ts` METRICS.
- Updated dependencies [700413b]
  - @revealui/contracts@0.8.3

## 0.1.2

### Patch Changes

- Real first publish: include compiled dist (0.1.1 version slot burned by empty/unpublish bootstrap).
- Emit CLI shebang so npm bin entry is valid.

## 0.1.1

### Patch Changes

- Updated dependencies [c02e613]
  - @revealui/contracts@0.8.2
