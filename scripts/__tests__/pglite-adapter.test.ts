/**
 * PGlite Adapter Integration Test
 *
 * Quick test to verify PGlite adapter works with the latest version.
 */

import { PGliteStateAdapter } from '../lib/state/adapters/pglite.js';
import { WorkflowStateMachine } from '../lib/state/workflow-state.js';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const testDir = join(process.cwd(), '.revealui', 'state', 'test-workflows');

  const adapter = new PGliteStateAdapter({
    dataDir: testDir
  });

  const machine = new WorkflowStateMachine({ adapter });

  try {
    await machine.initialize();
    console.log('✓ Adapter initialized');

    // Create a test workflow
    const workflow = await machine.create('test-workflow', [
      { id: 'step-1', name: 'Step 1', description: 'First step', requiresApproval: false },
      { id: 'step-2', name: 'Step 2', description: 'Second step', requiresApproval: true },
    ]);
    console.log('✓ Created workflow:', workflow.id);

    // Start the workflow
    const started = await machine.transition(workflow.id, { type: 'START' });
    console.log('✓ Started workflow, status:', started.status);

    // Load it back
    const loaded = await machine.load(workflow.id);
    if (!loaded) throw new Error('Failed to load workflow');
    console.log('✓ Loaded workflow:', loaded.name);

    // List workflows
    const list = await machine.list();
    console.log('✓ Listed workflows:', list.length);

    // Request approval
    const token = await machine.requestApproval(workflow.id, 'step-2');
    console.log('✓ Requested approval, token:', token.substring(0, 8) + '...');

    // Submit approval
    await machine.submitApproval(token, true);
    console.log('✓ Submitted approval');

    // Delete workflow
    await machine.delete(workflow.id);
    console.log('✓ Deleted workflow');

    await machine.close();
    console.log('✓ Closed connection');

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
    console.log('✓ Cleaned up test directory');

    console.log('\n✅ All PGlite adapter tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
    await machine.close();
    process.exit(1);
  }
}

main();
