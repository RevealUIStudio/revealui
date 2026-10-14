# RevealUI-native Studio CRM — complete draft implementation blueprint

Status: **draft, not production ready**. Tracking: #3127, PR #3128. No external CRM or Claude dependency.

## Functional modules
1. Organizations: canonical companies, verified sources, industry, location, deduplication.
2. Contacts: external business people, roles, contact channels, suppression and source provenance; never create auth users for prospects.
3. Opportunities: offer, stage, value, owner, forecast, next action and stage-change history.
4. Activities: immutable notes, calls, messages, meetings, edits, outcomes, actor and timestamps.
5. Tasks: reuse existing tickets/boards only after tenant and domain checks; link to opportunities with an explicit mapping.
6. Campaigns: audience criteria, enrollment, templates, approved drafts, sending limits, outcomes and opt-outs.
7. Native intelligence: opt-in local-model enrichment and drafting via RevealUI/MCP with evidence links, human approval and no automatic outbound.
8. Dashboard: stage funnel, overdue follow-ups, response rates, booked calls, pipeline value and actual revenue.
9. Import/export: CSV/public-source intake, idempotent deduplication, preview and dry run, rejection log, account-scoped export and deletion.
10. Governance: account membership, row-level authorization, field-level restrictions, audit trail, retention, suppression, and incident recovery.

## Critical design corrections to schema scaffold
- Composite account/organization FK requires matching unique (account_id,id) and nullable contact organization needs explicit ON DELETE behavior; verify migration SQL.
- An opportunity owner must be an active member of the same account, not merely an existing user.
- Store external contact suppression as boolean and add provenance, timestamps and channel-specific consent metadata.
- Sales opportunity stages are distinct from ticket statuses; do not force the ticket model to become a CRM model.
- Cross-account reads and writes must be denied by authenticated service boundaries; FK checks alone are insufficient.
- Use the canonical studio offers: Consultation $300, Pilot $3,997, Launch $14,500 (verify before public use).

## Delivery sequence (all work in drafts until verified)
A. Audit and ADR; B. schema/migrations; C. auth-scoped services; D. UI; E. tasks/activities; F. campaigns/outreach; G. local AI; H. import; I. dashboards; J. security/e2e/release.

## Release gates
No merge/deploy until generated migrations are reviewed, build/lint/typecheck/tests pass, cross-account attacks are rejected, suppression is enforced, outreach requires explicit approval, imports are idempotent, and a rollback is documented. No fabricated customer events.
