// Bounded above the measured 101-file, 4.3 MiB controller rollout while
// remaining below GitHub's 3,000-file API ceiling and the worker's memory budget.
export const MAX_REVIEW_FILES = 256;
export const MAX_REVIEW_BLOB_BYTES = 1024 * 1024;
export const MAX_REVIEW_CONTENT_BYTES = 8 * 1024 * 1024;
