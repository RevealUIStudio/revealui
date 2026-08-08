/**
 * Stdio transport for the RevealUI ACP agent (Zed / JetBrains / ACP clients).
 */

import { Readable, Writable } from 'node:stream';
import type { RevealUiAcpAgentOptions } from './agent.js';
import { acp, createRevealUiAcpAgent } from './agent.js';

/**
 * Serve ACP on process stdin/stdout until the connection closes.
 */
export function runRevealUiAcpAgentStdio(
  options: RevealUiAcpAgentOptions = {},
): acp.AgentConnection {
  // Agent → client: write to stdout. Client → agent: read from stdin.
  const output = Writable.toWeb(process.stdout);
  const input = Readable.toWeb(process.stdin);
  const stream = acp.ndJsonStream(output, input);
  const app = createRevealUiAcpAgent(options);
  return app.connect(stream);
}
