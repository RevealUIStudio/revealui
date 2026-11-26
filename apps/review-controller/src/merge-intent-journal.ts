import { createHash } from 'node:crypto';
import { and, eq, inArray, notExists } from '@revealui/db/orm';
import {
  reviewControllerMergeIntents as intents,
  reviewControllerMergeReconciliationObservations as observations,
  type ReviewControllerDatabase,
} from '@revealui/db/review-controller';
import { alias } from 'drizzle-orm/pg-core';
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
    await this.db
      .insert(intents)
      .values({
        jobId: intent.jobId,
        repositoryId: intent.repositoryId,
        baseRef: intent.baseRef,
        canonicalPayload: canonical,
        payloadSha256: digest,
      })
      .onConflictDoNothing({ target: intents.jobId });
    const row = await this.get(intent.jobId);
    if (row.payloadSha256 !== digest || row.canonicalPayload !== canonical)
      throw new Error('merge_intent_id_collision');
    return { jobId: intent.jobId, digest, state: row.state };
  }

  async recordInertDispatch(jobId: string) {
    const row = await this.get(jobId);
    validateMergeIntent(JSON.parse(String(row.canonicalPayload)), this.now());
    if (row.state !== 'proposed') throw new Error('merge_intent_already_consumed');
    try {
      const other = alias(intents, 'other_intent');
      const updated = await this.db
        .update(intents)
        .set({ state: 'dispatch-committed' })
        .where(
          and(
            eq(intents.jobId, jobId),
            eq(intents.state, 'proposed'),
            notExists(
              this.db
                .select({ jobId: other.jobId })
                .from(other)
                .where(
                  and(
                    eq(other.repositoryId, intents.repositoryId),
                    eq(other.baseRef, intents.baseRef),
                    inArray(other.state, ['dispatch-committed', 'unknown']),
                  ),
                ),
            ),
          ),
        )
        .returning({ jobId: intents.jobId });
      if (updated.length !== 1) throw new Error('merge_scope_quarantined');
    } catch (error) {
      if (hasCode(error, '23505')) throw new Error('merge_scope_quarantined');
      throw error;
    }
    return { jobId, state: 'dispatch-committed', inert: true as const };
  }

  async quarantine(jobId: string) {
    const row = await this.get(jobId);
    if (row.state === 'unknown') return;
    const updated = await this.db
      .update(intents)
      .set({ state: 'unknown' })
      .where(and(eq(intents.jobId, jobId), eq(intents.state, 'dispatch-committed')))
      .returning({ jobId: intents.jobId });
    if (updated.length !== 1) throw new Error('merge_intent_not_dispatched');
  }

  /** Restart cannot infer rejection from a lost worker or unchanged refs. */
  async quarantineAbandonedDispatches() {
    const result = await this.db
      .update(intents)
      .set({ state: 'unknown' })
      .where(eq(intents.state, 'dispatch-committed'))
      .returning({ jobId: intents.jobId });
    return result.length;
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
    await this.db
      .insert(observations)
      .values({
        observationId: id,
        jobId: input.jobId,
        kind: input.kind,
        evidenceSha256: input.evidenceSha256,
        observedAt: new Date(input.observedAt),
      })
      .onConflictDoNothing({ target: observations.observationId });
    const stored = await this.db
      .select({
        jobId: observations.jobId,
        kind: observations.kind,
        evidenceSha256: observations.evidenceSha256,
        observedAt: observations.observedAt,
      })
      .from(observations)
      .where(eq(observations.observationId, id));
    const row = stored[0];
    if (
      !row ||
      row.jobId !== input.jobId ||
      row.kind !== input.kind ||
      row.evidenceSha256 !== input.evidenceSha256 ||
      (row.observedAt instanceof Date
        ? row.observedAt.getTime()
        : Date.parse(String(row.observedAt))) !== Date.parse(input.observedAt)
    )
      throw new Error('merge_reconciliation_observation_unconfirmed');
    // Observations never clear quarantine: authenticated outcome/fencing
    // semantics have not been defined or reviewed for a live transport.
    return { observationId: id, hold: 'merge_reconciliation_authority_unsupported' };
  }

  private async get(jobId: string) {
    if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error('merge_job_id_invalid');
    const result = await this.db
      .select({
        canonicalPayload: intents.canonicalPayload,
        payloadSha256: intents.payloadSha256,
        state: intents.state,
      })
      .from(intents)
      .where(eq(intents.jobId, jobId));
    const row = result[0];
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
