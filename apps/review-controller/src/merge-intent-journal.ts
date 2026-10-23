import { createHash } from 'node:crypto';
import type { ReviewControllerDatabase } from '@revealui/db/review-controller';
import { sql } from 'drizzle-orm';
import { canonicalMergeIntent, mergeIntentSha256, validateMergeIntent } from './merge-admission.js';

/** No caller-supplied transport, signing, object upload, GitHub calls or runtime
 * registration. Dispatch records are inert, never authorization to execute.
 * The migration intentionally grants the current runtime role no access. */
export class PostgresMergeIntentJournal {
  constructor(
    private readonly db: ReviewControllerDatabase,
    private readonly now = () => new Date(),
  ) {}

  async propose(input: unknown) {
    const intent = validateMergeIntent(input, this.now());
    const canonical = canonicalMergeIntent(intent);
    const digest = mergeIntentSha256(intent);
    await this.db.execute(sql`
      INSERT INTO review_controller_merge_intents
        (job_id, repository_id, base_ref, canonical_payload, payload_sha256)
      VALUES (${intent.jobId}, ${intent.repositoryId}, ${intent.baseRef}, ${canonical}, ${digest})
      ON CONFLICT (job_id) DO NOTHING
    `);
    const row = await this.get(intent.jobId);
    if (row.payload_sha256 !== digest || row.canonical_payload !== canonical)
      throw new Error('merge_intent_id_collision');
    return { jobId: intent.jobId, digest, state: row.state };
  }

  async recordInertDispatch(jobId: string) {
    const row = await this.get(jobId);
    validateMergeIntent(JSON.parse(String(row.canonical_payload)), this.now());
    if (row.state !== 'proposed') throw new Error('merge_intent_already_consumed');
    try {
      const updated = await this.db.execute(sql`
        UPDATE review_controller_merge_intents j SET state = 'dispatch-committed'
        WHERE job_id = ${jobId} AND state = 'proposed'
          AND NOT EXISTS (SELECT 1 FROM review_controller_merge_intents other
            WHERE other.repository_id = j.repository_id AND other.base_ref = j.base_ref
              AND other.state IN ('dispatch-committed', 'unknown'))
        RETURNING job_id
      `);
      if (updated.rows.length !== 1) throw new Error('merge_scope_quarantined');
    } catch (error) {
      if (hasCode(error, '23505')) throw new Error('merge_scope_quarantined');
      throw error;
    }
    return { jobId, state: 'dispatch-committed', inert: true as const };
  }

  async quarantine(jobId: string) {
    const row = await this.get(jobId);
    if (row.state === 'unknown') return;
    const updated = await this.db.execute(sql`
      UPDATE review_controller_merge_intents SET state = 'unknown'
      WHERE job_id = ${jobId} AND state = 'dispatch-committed' RETURNING job_id
    `);
    if (updated.rows.length !== 1) throw new Error('merge_intent_not_dispatched');
  }

  /** Restart cannot infer rejection from a lost worker or unchanged refs. */
  async quarantineAbandonedDispatches() {
    const result = await this.db.execute(sql`
      UPDATE review_controller_merge_intents SET state = 'unknown'
      WHERE state = 'dispatch-committed' RETURNING job_id
    `);
    return result.rows.length;
  }

  async recordReconciliationObservation(input: {
    jobId: string;
    kind:
      | 'refs-unchanged'
      | 'refs-advanced'
      | 'pr-outcome-observed'
      | 'definitive-rejection'
      | 'delivery-uncertain';
    evidenceSha256: string;
    observedAt: string;
  }) {
    await this.get(input.jobId);
    if (
      !(
        [
          'refs-unchanged',
          'refs-advanced',
          'pr-outcome-observed',
          'definitive-rejection',
          'delivery-uncertain',
        ].includes(input.kind) &&
        /^[a-f0-9]{64}$/.test(input.evidenceSha256) &&
        Number.isFinite(Date.parse(input.observedAt))
      ) ||
      new Date(input.observedAt).toISOString() !== input.observedAt ||
      Date.parse(input.observedAt) > this.now().getTime()
    )
      throw new Error('merge_reconciliation_observation_invalid');
    const id = createHash('sha256')
      .update(JSON.stringify([input.jobId, input.kind, input.evidenceSha256, input.observedAt]))
      .digest('hex');
    await this.db.execute(sql`
      INSERT INTO review_controller_merge_reconciliation_observations
        (observation_id, job_id, kind, evidence_sha256, observed_at)
      VALUES (${id}, ${input.jobId}, ${input.kind}, ${input.evidenceSha256}, ${new Date(input.observedAt)})
      ON CONFLICT (observation_id) DO NOTHING
    `);
    const stored = await this.db.execute(sql`
      SELECT job_id, kind, evidence_sha256, observed_at
      FROM review_controller_merge_reconciliation_observations WHERE observation_id = ${id}
    `);
    const row = stored.rows[0];
    if (
      !row ||
      row.job_id !== input.jobId ||
      row.kind !== input.kind ||
      row.evidence_sha256 !== input.evidenceSha256 ||
      (row.observed_at instanceof Date
        ? row.observed_at.getTime()
        : Date.parse(String(row.observed_at))) !== Date.parse(input.observedAt)
    )
      throw new Error('merge_reconciliation_observation_unconfirmed');
    // Observations never clear quarantine: authenticated outcome/fencing
    // semantics have not been defined or reviewed for a live transport.
    return { observationId: id, hold: 'merge_reconciliation_authority_unsupported' };
  }

  private async get(jobId: string) {
    if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error('merge_job_id_invalid');
    const result = await this.db.execute(sql`
      SELECT canonical_payload, payload_sha256, state
      FROM review_controller_merge_intents WHERE job_id = ${jobId}
    `);
    const row = result.rows[0];
    if (!row) throw new Error('merge_intent_not_found');
    return row;
  }
}

function hasCode(error: unknown, code: string): boolean {
  let current = error;
  for (let i = 0; i < 4 && current && typeof current === 'object'; i++) {
    if ('code' in current && current.code === code) return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
