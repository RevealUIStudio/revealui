/**
 * Tunable caps for the RevMind diagram job (P1).
 *
 * Consultation sketches stay lightweight. Launch architecture is the
 * licensed path and may draw a larger snapshot. Override via
 * {@link configureDiagramJob} in tests — never hardcode limits at call sites.
 */

export interface DiagramJobConfig {
  /** Max nodes in a consultation_sketch (default: 24). */
  consultationMaxNodes: number;
  /** Max BFS depth for consultation_sketch (default: 2). */
  consultationMaxDepth: number;
  /** Max nodes in a launch_architecture diagram (default: 200). */
  launchMaxNodes: number;
  /** Max BFS depth for launch_architecture (default: 6). */
  launchMaxDepth: number;
  /** Hard SQL/snapshot row cap before subgraph selection (default: 2000). */
  snapshotRowLimit: number;
}

const DEFAULT_DIAGRAM_JOB_CONFIG: DiagramJobConfig = {
  consultationMaxNodes: 24,
  consultationMaxDepth: 2,
  launchMaxNodes: 200,
  launchMaxDepth: 6,
  snapshotRowLimit: 2000,
};

let diagramJobConfig: DiagramJobConfig = { ...DEFAULT_DIAGRAM_JOB_CONFIG };

export function getDiagramJobConfig(): DiagramJobConfig {
  return diagramJobConfig;
}

export function configureDiagramJob(overrides: Partial<DiagramJobConfig>): void {
  diagramJobConfig = { ...DEFAULT_DIAGRAM_JOB_CONFIG, ...overrides };
}

export function resetDiagramJobConfig(): void {
  diagramJobConfig = { ...DEFAULT_DIAGRAM_JOB_CONFIG };
}

export function capsForPurpose(purpose: 'consultation_sketch' | 'launch_architecture'): {
  maxNodes: number;
  maxDepth: number;
} {
  if (purpose === 'consultation_sketch') {
    return {
      maxNodes: diagramJobConfig.consultationMaxNodes,
      maxDepth: diagramJobConfig.consultationMaxDepth,
    };
  }
  return {
    maxNodes: diagramJobConfig.launchMaxNodes,
    maxDepth: diagramJobConfig.launchMaxDepth,
  };
}
