import { GitHubAppClient } from './github-app.js';
import { requestStructuredReview, TrustedReviewerWebhookHandler } from './trusted-reviewer.js';

function required(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string): number {
  const value = required(name);
  const parsed = Number(value);
  if (!(/^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(parsed)))
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function main(): Promise<void> {
  const repositoryId = positiveInteger('GITHUB_REPOSITORY_ID');
  const reviewer = {
    id: positiveInteger('GITHUB_REVIEWER_BOT_ID'),
    login: required('GITHUB_REVIEWER_BOT_LOGIN'),
  };
  if (!/^[A-Za-z0-9-]+\[bot\]$/.test(reviewer.login))
    throw new Error('GITHUB_REVIEWER_BOT_LOGIN must name a GitHub App bot');
  const apiKey = required('OPENAI_API_KEY');
  const model = required('OPENAI_REVIEW_MODEL');
  const policyVersion = required('OPENAI_REVIEW_POLICY_VERSION');
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(policyVersion))
    throw new Error('invalid OPENAI_REVIEW_POLICY_VERSION');
  const github = new GitHubAppClient({
    appId: positiveInteger('GITHUB_APP_ID'),
    installationId: positiveInteger('GITHUB_INSTALLATION_ID'),
    repositoryId,
    repositoryFullName: required('GITHUB_REPOSITORY_FULL_NAME'),
    privateKey: required('GITHUB_APP_PRIVATE_KEY'),
    role: 'reviewer',
  });
  const handler = new TrustedReviewerWebhookHandler(
    github,
    { repositoryId, reviewer, policyVersion, model },
    (snapshot) => requestStructuredReview({ snapshot, apiKey, model, policyVersion }),
  );
  await handler.reviewPullRequest(positiveInteger('REVIEW_PULL_REQUEST_NUMBER'));
}

main().catch((error: unknown) => {
  process.stderr.write(
    `trusted-reviewer failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
