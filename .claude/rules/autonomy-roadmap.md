# Autonomy Roadmap

Progressive path from human-supervised to fully autonomous development.

## Stage 1 — Multi-Instance Coordination (current)

Two Claude Code instances share a workboard (`.claude/workboard.md`) to coordinate tasks, file reservations, and context. Human is at the keyboard approving actions.

**Deliverables:**
- Shared workboard protocol (see `coordination.md`)
- Distribution documentation (see `distribution.md`)
- Instance identity detection (terminal vs editor)

**Status:** Implemented

## Stage 2 — Agent Communication Protocol

Instances communicate beyond the workboard: direct message passing, request/response patterns, and shared decision logs with enterprise-grade security.

**Deliverables:**
- Message queue (file-based or lightweight broker) for inter-agent messages
- Signed messages with verification (prevent spoofing between agents)
- Validation loops: agents verify each other work before merging
- Shared decision log with audit trail (who decided what, when, why)
- Works identically whether agents are on the same machine or different hosts

**Security requirements:**
- Message authentication (HMAC or asymmetric signatures)
- Agent identity verification on every message
- Tamper-evident decision log (append-only, checksummed)
- Rate limiting to prevent runaway agent loops
- Escalation protocol: agents can flag decisions for human review

## Stage 3 — Mobile Approvals

Push permission prompts to phone instead of requiring the developer at the computer. Step away from the desk and still approve/deny agent actions.

**Architecture options:**
- Telegram bot (low friction, quick setup)
- Discord bot (if already using Discord)
- Custom PWA with push notifications (most control)
- ntfy.sh (open-source, self-hostable push notifications)

**Deliverables:**
- Approval server (Hono endpoint in the monorepo or standalone)
- Webhook bridge: Claude Code permission → push notification → response
- Timeout handling: default-deny if no response within N minutes
- Audit log of all approvals/denials with timestamps

## Stage 4 — Remote Execution

Run Claude Code sessions on cloud VMs, DevBox (plugged in anywhere), or any remote host. Approve from phone. Agents can be distributed across machines.

**Deliverables:**
- SSH tunnel or Tailscale mesh for secure remote access
- Session persistence across disconnects
- LTS drive as portable state synchronization
- Multi-machine agent coordination (extends Stage 1 workboard to network)
- Secure agent registration (new agents must authenticate before joining)

## Stage 5 — Spec-Driven Full Autonomy

Write a specification, walk away, come back to a deployed feature. No human interaction needed after the spec is approved.

**Spec format requirements:**
- Detailed enough that an agent can implement full complex features
- Acceptance criteria with testable assertions
- Architecture constraints and patterns to follow
- Security and performance requirements
- Rollback criteria (when to auto-revert)

**Agent pipeline:**
1. **Planner** — reads spec, breaks into tasks, assigns to implementers
2. **Implementer(s)** — write code following spec and repo conventions
3. **Reviewer** — automated code review against style, security, and correctness rules
4. **Tester** — runs full CI gate, E2E tests, integration tests
5. **Deployer** — merges to main, triggers deployment pipeline
6. **Monitor** — watches production metrics, auto-rollback on anomalies

**Digital clone:**
- Decision framework trained on founder patterns and preferences
- Encodes: coding style, architecture preferences, business priorities, risk tolerance
- Makes judgment calls that would normally require the human
- Transparent reasoning: every autonomous decision logged with rationale
- Override mechanism: human can retroactively review and reverse decisions

## Master Plan Consolidation

All agents across all environments (laptop WSL, DevBox, LTS, remote) work from one master plan. The plan lives in the primary repo and syncs via git. No environment-local plans — everything is shared, versioned, and auditable.

**Rules:**
- One source of truth: `~/projects/RevealUI` (WSL native) → GitHub → all clones
- Plans are committed to git (not gitignored) so all environments see them
- Stale local plans found on other drives should be merged into the master and deleted
- The workboard (`.claude/workboard.md`) is the only ephemeral coordination file

## Plan Consolidation

### Current State (as of 2026-02-18)
- **61 plan files** scattered across 3 locations:
  - 9 hand-authored strategic docs in `docs/`, `business/`, `.claude/`
  - 15 auto-generated Claude Code plans in Windows `~/.claude/plans/`
  - 37 auto-generated Claude Code plans in WSL `~/.claude/plans/`

### Key Strategic Documents
1. `docs/plans/pending/PRIORITIZED_ACTION_PLAN.md` — active sprint plan
2. `docs/PROJECT_ROADMAP.md` — overarching project roadmap
3. `business/BUSINESS_PLAN.md` — RevealUI Studio LLC business plan
4. `docs/plans/pending/UNFINISHED_WORK_INVENTORY.md` — incomplete work tracker

### Consolidation Rules
- One master plan in the repo (`docs/plans/` hierarchy) — committed to git, visible to all agents
- Auto-generated Claude Code session plans (`~/.claude/plans/`) are ephemeral — useful for session context but not authoritative
- Stale plans on LTS or DevBox clones are superseded by the WSL primary/GitHub version
- Any agent on any environment reads the same master plan via git

## Agent Communication Protocol (Stage 2 Detail)

### Message Types
- **task-update**: Instance reports progress on current task
- **file-claim**: Instance requests exclusive write access to files
- **file-release**: Instance releases file claims
- **context-share**: Instance shares a discovery or decision
- **review-request**: Instance requests another agent to review work
- **review-response**: Agent provides review feedback
- **escalate**: Agent flags a decision for human review

### Security Model (Enterprise-Grade)
- **Identity**: Each agent instance has a unique ID (e.g., `terminal-1@laptop`, `zed-1@devbox`)
- **Authentication**: Messages are HMAC-signed with a shared secret (SOPS-encrypted)
- **Integrity**: Append-only decision log with SHA-256 checksums
- **Non-repudiation**: Every decision logged with agent ID, timestamp, and rationale
- **Verification loops**:
  1. Author agent writes code
  2. Reviewer agent runs lints, tests, and reads the diff
  3. Reviewer agent approves or requests changes
  4. Only approved code is committed
- **Validation gates**: CI gate must pass before merge (already enforced)
- **Rate limiting**: Max N messages per minute to prevent agent loops
- **Escalation**: Agents can escalate to human when confidence is below threshold

### Communication Transport (Options)
1. **File-based** (simplest): JSON messages in `.claude/messages/` — polled by each instance
2. **SQLite**: Shared DB file for structured queries and atomic writes
3. **WebSocket** (Stage 4): Real-time communication for distributed agents
4. **Message queue** (Stage 4): Redis/NATS for production multi-machine setups
