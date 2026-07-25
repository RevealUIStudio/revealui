---
'@revealui/harnesses': minor
---

Delete the zero-consumer coordination-daemon twin per GAP-421's DELETE train
(audit step 8, daemon-ownership ADR 2026-07-25): `goals/`, `server/rpc-server.ts`,
`server/spawner-service.ts`, `server/shared-memory-client.ts`, `coordinator.ts`,
and `coordination/` (3,002 source LOC + 1,211 test LOC), plus the `start` and
`coordinate --init` CLI subcommands that were the only thing constructing the
now-deleted `HarnessCoordinator`. The RevDev daemon owns the coordination
runtime and the harness socket; this package keeps the CLI, content
definitions, and `./gates`. The published `./goals` subpath export is removed
— a breaking change for any external importer, hence the minor bump inside 0.x.

`server/http-gateway.ts` stays (it is ported into the RevDev daemon separately);
its `RpcServer` type import is replaced with a minimal local `RpcDispatch`
structural interface covering its one real usage (`dispatchHttp`), plus
`GatewayStore` and `SpawnerLike` structural interfaces covering its `DaemonStore`
and `SpawnerService` couplings the same way, so the module keeps compiling
without those two also-deleted types.

`storage/` and `config/` were in the ADR's DELETE list but are NOT deleted here:
`storage/` backs `server/__tests__/http-gateway.test.ts`'s real (non-mocked)
security test suite (GAP-353 auth flow), and `config/` is a real production
dependency of `adapters/cursor-adapter.ts` and `adapters/opencode-adapter.ts`
(both staying, INCUBATE). Both are consumers the ADR's routing did not account
for; deleting either would have required rewriting or gutting working code/tests
outside this train's scope, so they were left in place and reported instead.
