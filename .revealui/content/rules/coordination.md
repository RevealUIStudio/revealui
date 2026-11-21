# Multi-Instance Coordination

Multiple agents may work concurrently. Resolve the internal coordination hub through the repo
`docs/INDEX.md` Fleet coordination entry (ADR-005). Its `.revealui/workboard.md`
is rendered from vendor-neutral `.revealui/workboard.d/` fragments. `.claude/workboard.md` is an adapter pointer,
not another board. Read the hub `.revealui/README.md` and its workboard lifecycle
contract before writing coordination evidence.

## Identity

Agent identity is resolved automatically by `session-start.js` using a 3-tier detection cascade. The result is cached for the session in `/tmp/revealui-session-<ppid>.id`.

### Identity Taxonomy

| Identity | Detection Signal | Context |
|----------|-----------------|---------|
| `conductor` | `CLAUDE_AGENT_ROLE=conductor` | Primary orchestration agent |
| `agent-extension` | `/proc` walk finds `zed` + no `CLAUDE_TERMINAL_CONTEXT` | Zed ACP inline (editor extension) |
| `agent-extension-2`, `-3`... | same, second+ Zed window | Multiple editor extension instances |
| `agent-edit` | `/proc` walk finds `zed` + `CLAUDE_TERMINAL_CONTEXT=zed-terminal` | Zed integrated terminal |
| `agent-edit-2`, `-3`... | same, second+ instance | Multiple editor terminals |
| `agent-system` | `WT_SESSION` present (any WT profile) | Any Windows Terminal / plain WSL terminal |
| `agent-system-2`, `-3`... | same, second+ instance | Multiple system terminals |
| (daemon-assigned) | `CLAUDE_AGENT_ROLE` set by SpawnerService | Native terminal PTY sessions |

### Detection Cascade (3 tiers)

1. **Explicit env var** — `CLAUDE_AGENT_ROLE` set (daemon SpawnerService, shell export). Highest priority. Legacy values (`zed-extension`, `wsl`, `forge`, etc.) are aliased to canonical names. Daemon-spawned agents get identity assigned at spawn time.
2. **Session cache** — `/tmp/revealui-session-<ppid>.id` with timestamp. Reuses previous detection within 8h.
3. **Auto-detect** — Zed (proc walk), Windows Terminal (`WT_SESSION`), or generic `agent-system-N`. Indexed via `nextIndexedId` against workboard active rows.

### Configuration

Profile mappings live in the fleet `.revealui` (`agent-profiles.json`). Vendor homes are adapters:
- `wt_profiles`: maps Windows Terminal profile GUID → identity
- `default_zed_extension_name` / `default_zed_terminal_name`: override Zed auto-detection names

On session start, the detected identity is logged. You can check it in the workboard Sessions table.

## Maintained Workboard Lifecycle

The owning tools are in the resolved internal hub's `scripts/` directory:
`workboard-heartbeat.js`, `workboard-fragment.js`, `workboard-sweep.js`, and
`workboard-check.js`. Their maintained contract and the hub
`.revealui/workboard.d/active/README.md` govern lifecycle; this profile does not
promise that a vendor hook registered a session or captured every edited file.

- Active heartbeats are working-tree-only `active/pid-<ppid>.md` records with
  `last-seen:` evidence. Only timestamps within **45 minutes**, at or before
  the observation time, establish freshness. Unknown, future, and expired
  claims are omitted. A registered worktree is not evidence of a live session.
- Write only your own heartbeat and append-only note/log fragments through
  the maintained helpers. Identify the existing gap/lane/PR and reserved paths
  in the claim. Re-read current claims before editing overlapping paths.
- Notes carry an expiry; expired or malformed expiry evidence invalidates the
  whole note. The neutral fragment wins a same-name legacy collision. Consult
  the hub contract for retention of untagged historical notes and log archives.
- The sweep owns generated marker blocks. Do not append manual session rows,
  board headings, task queues, or free-peer placeholders. Do not edit generated
  blocks to manufacture freshness. Skipped or unavailable discovery leaves
  explicitly unverified snapshots; re-check the owning evidence before acting.

## Handoff Protocol

Record incomplete work in the hub's maintained rolling handoff and coordination
fragment paths, naming the existing gap/lane, branch/worktree, observed validation,
remaining work, and owner decisions. The receiving agent re-verifies those
receipts and records its own claim; an old handoff does not establish ownership.
Do not create a Plans queue or edit another session's heartbeat.

Commit coordination evidence in an isolated hub branch from `origin/test` and
submit its normal review proposal. Do not push a handoff directly to `origin/main`
or `origin/test`; publication and promotion keep their owner disposition gates.

## Archive-Readiness Convention

When preparing a session for archive (full handoff to a new session, not just a sub-agent handoff within the same session), the **final output to the owner** must be a copy-pasteable "next-agent prompt" they can drop straight into a new Claude Code session — no synthesis required, no jumping between docs to assemble context.

The prompt is non-negotiable. Without it, the owner has to do friction work (read handoff doc + workboard + memories + figure out the first action) every time a session hands off. That friction adds up across the fleet.

### What the prompt must include

1. **Session id + handoff-doc path** as the first line. The next agent must read the handoff before doing anything else.
2. **TL;DR**: 1–2 sentences capturing the lane's state and the single most important next action.
3. **Ordered next-actions with exact commands / values / file paths**. No "investigate X" or "decide Y" — those belong in the handoff doc body. Prompt commands are mechanical and ready-to-run.
4. **Locked-posture reminder** (one line): `core.fileMode=false`, explicit pathspec on shared checkouts, `-F /tmp/cmsg-*.txt`, `--body-file`, no `--auto`, no `--no-verify`, audit-first SDLC, branch from `origin/test`, etc.
5. **Owner-gated deferrals** (one short list): any item the next agent should NOT auto-pick up without owner sign-off.

### What the prompt must NOT include

- Open-ended questions ("what do you think we should do about X?") — those belong in the handoff doc §"Open Questions" with read-before-acting framing.
- Implementation details that change frequently — link to the handoff doc instead so a single source of truth wins.
- Anything the owner has to fill in (paths, hashes, secrets to fetch) — pre-resolve at archive time. If the prompt needs `<paste prod URL here>`, you've failed.

### Format

Wrap the prompt in a single fenced code block (` ``` `) the owner can triple-click to select. End the archive turn with this block; nothing after it.

### Convention added

2026-05-11 by session 6176c881. Rationale: friction-elimination on session boundaries. Codified after the 2026-05-11 prod-deploy-gate-recovery session demonstrated that even with a thorough handoff doc + workboard Log entry + session beacon, the owner still had to construct the next-agent prompt by hand — pure overhead the convention now eliminates.

## Conflict Resolution

- File reservations are **advisory**, not locks. If you must edit a reserved file, record an expiring coordination note on the owning hub surface so the other instance sees it on next read.
- For **architectural decisions** (new packages, schema changes, API contracts), record them against the owning gap/lane and wait for the other instance to acknowledge before proceeding — but only if that instance is actively working in the affected area.
- **Git conflicts** are resolved by whichever instance commits second. That instance must pull and rebase or merge before pushing.

## Master Plan Protocol

The master plan lives in the internal coordination hub, per ADR-005 (see the
repo's `docs/INDEX.md` "Fleet coordination"). Day-to-day free surfaces:
hub `docs/TRACKER.md`.

The in-repo `docs/MASTER_PLAN.md` is a **retired public pointer stub**
(2026-07-16), not the plan of record. Maintainers may edit the stub so it
stays an honest pointer (GAP-336 allowlist); do not put fleet phase work there.
Stray `MASTER_PLAN.md` files outside the holster allowlist remain blocked.

1. **On session start**: Read the hub TRACKER / plan surfaces that apply. Your work must align with free surfaces or a named gap/lane.
2. **Before starting any task**: Verify the task is listed on TRACKER or an open gap/lane. If not listed, ask the user before proceeding.
3. **After completing any task**: Update the owning gap/lane or hub handoff surfaces (a separate commit to the private repo, per ADR-005).
4. **When discovering new work**: File a gap or update a lane in the hub; do not create separate plan files in this repo.
5. **When multiple agents are active**: Re-read TRACKER / workboard before starting new work.
6. **When updating hub plan surfaces**: Also note the workboard when coordination requires it.

## Workboard Format

Use the hub's maintained helpers and README for the current fragment and render
formats. The board is a coordination view, not a second backlog or an editable
Sessions/Recent/Plans schema. Durable execution status belongs to the owning
gap YAML or lane plan; TRACKER is generated from those sources and initiative
membership. Do not recreate the retired vendor-local table format here.
