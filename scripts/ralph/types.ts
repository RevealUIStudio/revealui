/**
 * TypeScript types for Ralph-inspired iterative workflow
 */

export interface RalphState {
	active: boolean;
	iteration: number;
	max_iterations: number;
	completion_promise: string | null;
	started_at: string;
	prompt_file: string;
	completion_marker: string;
}

export interface RalphStateFile {
	frontmatter: RalphState;
	prompt: string;
}

export interface RalphStartOptions {
	prompt: string;
	maxIterations?: number;
	completionPromise?: string;
	brutalHonesty?: boolean; // Default: true for cohesion workflows
}
