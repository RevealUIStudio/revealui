export interface CodexReviewObservation {
  provider: 'codex-subscription';
  reviewerLogin: string;
  reviewerId: number;
  reviewId: number;
  reviewedHeadSha: string;
  currentHeadSha: string;
  state: 'commented' | 'approved' | 'changes_requested' | 'dismissed';
  action: 'submitted' | 'edited' | 'dismissed';
  observedAt: string;
  bodySha256: string;
  inlineCommentCount: number;
  inlineComments: Array<{
    commentId: number;
    path: string;
    line: number | null;
    severity: 'critical' | 'high';
    bodySha256: string;
  }>;
  submittedAt: string | null;
  exactHead: boolean;
  receiptReview?: {
    reviewerId: string;
    system: string;
    executionId: string;
    revisionSha: string;
    verdict: 'approve' | 'request-changes';
    criticalFindings: number;
    highFindings: number;
  };
}

export type ReviewEvidence =
  | { status: 'not_observed' }
  | { status: 'not_requested' }
  | { status: 'observed'; review: CodexReviewObservation };

/** Review text is hashed at intake and never persisted. */
export function redactReviewEvidence(evidence: ReviewEvidence): Record<string, unknown> {
  return evidence;
}
