# Model Allocation — Work Class First, Provider Second

**Status:** convention. Routes which kind of work goes to which kind of model
or agent.

## Principle

1. **Work class** describes the *task* (Design, Build, Verify, Deploy).
2. **Provider profile** describes *who runs the weights* (a frontier model
   family, an implementer-tier model, a local/open model). Profiles are a
   peer senior band with different strengths, not a strict power ranking.
3. **The product's control layer** (if the project has one) is where policy,
   routing, execution, and audit for governed AI work live. Harness-specific
   configs (an editor's agent config, a CLI's rule files) stay thin adapters
   on top of it, not a second implementation of the same policy.
4. **Owner disposition** (merging security-sensitive PRs, gating labels,
   money, legal) is never allocated to a model.

Same result, right capability bar, lowest cost and lowest external exposure
where it matters.

## Work classes

| Class | Question | Typical output |
|-------|----------|-----------------|
| **Design** | What should be true? Which trade-offs bind? | Spec, decision doc, open-question rulings, acceptance criteria |
| **Build** | Make the design real | Branch from the integration ref, PRs, tests (prove red, then green) |
| **Verify** | True, safe, and not self-checked by the author? | CI, independent review, probes, claim gates |
| **Deploy** | Runs where users live? | Promote to the production branch, env, seed, worker, smoke test |

### Class rules

1. Ambiguous or security-sensitive work gets Design before Build.
2. Crown-jewel surfaces (auth, license, entitlements, tenant boundaries,
   webhooks, signing, agent spawning): Verify must not be the same session
   that authored the Build. Any senior profile may Verify; the rule is about
   process integrity, not brand.
3. Deploy means promote plus runtime honesty, not just "CI is green on a
   feature branch."
4. Mechanical polish is light Build or automated Verify, not a fifth class.
5. Escalate on ambiguity rather than improvising architecture during Build.

### Lifecycle

```text
Design → Build → Verify → Deploy
   ↑        │        │
   │        └── rebuild on verify fail
   └────────── redesign when verify/deploy finds a design hole
```

## Provider profiles

| Family | Route here when |
|--------|------------------|
| Senior frontier model | Long structured Build; security Design; dense review |
| A second senior frontier model (if available) | Multi-repo synthesis, combined Design+Build sessions, Verify peer |
| Implementer-tier model | Low-ambiguity Build once Design is fixed |
| Local / open-weight model | Cheap draft or classify work where local capability is proven sufficient |

Prefer the cheapest model that is actually capable of the work class, not the
most powerful model available. Frontier is opt-in by route decision, not a
default for every task.

## Security surfaces

Anything on a sensitive-path list (auth, licensing, tenant boundaries,
signing, agent spawning) gets a Design pass and a non-author Verify pass, not
"must be a specific brand of model." Implementation is Build against a
countersigned design. The project owner still disposes of merges and gating
labels.
