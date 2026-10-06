/** Protected App scope shared by webhook validation and installation-token minting. */
export const GITHUB_APP_WEBHOOK_EVENTS = [
  'pull_request',
  'pull_request_review',
  'check_run',
  'check_suite',
  'merge_group',
] as const;

/** Request this subset when minting each installation token. */
export const GITHUB_INSTALLATION_PERMISSIONS = Object.freeze({
  checks: 'write',
  contents: 'read',
  merge_queues: 'read',
  pull_requests: 'write',
} as const);
