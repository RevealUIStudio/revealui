/**
 * Agents — server shell.
 *
 * Resolves the GAP-360 hosted flag server-side via isHostedDeployment
 * (GAP-260 P4-1: REVEALUI_DEPLOYMENT_MODE, fallback private-key presence) and
 * hands the boolean down to the client page, mirroring the settings/api-keys
 * shell. The MCP Servers tab uses it to stop telling hosted customers to run
 * a local CLI command they cannot run (GAP-360 §5.7).
 */

import { isHostedDeployment } from '@revealui/core/deployment-mode';
import AgentsPageClient from './agents-client';

export default function AgentsPage() {
  const isHosted = isHostedDeployment(process.env);

  return <AgentsPageClient isHosted={isHosted} />;
}
