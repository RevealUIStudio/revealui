'use client';

import type { A2ATask } from '@revealui/contracts';
import { useState } from 'react';
import { getApiUrl } from '@/lib/config/api';

interface TaskTesterProps {
  agentId: string;
  agentName: string;
  onComplete?: () => void;
}

type TesterState = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

/**
 * Interactive task tester for an A2A agent.
 * Sends a tasks/send JSON-RPC call and streams/polls the result.
 */
export function TaskTester({ agentId, agentName, onComplete }: TaskTesterProps) {
  const [instruction, setInstruction] = useState('');
  const [state, setState] = useState<TesterState>('idle');
  const [task, setTask] = useState<A2ATask | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  async function submit() {
    if (!instruction.trim()) return;
    setState('submitting');
    setTask(null);
    setErrorMsg(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Agent-ID': agentId,
    };

    try {
      const res = await fetch(`${apiUrl}/a2a`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tasks/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: instruction }],
            },
          },
        }),
      });

      const json = (await res.json()) as {
        result?: A2ATask;
        error?: { code: number; message: string };
      };

      if (json.error) {
        setErrorMsg(json.error.message);
        setState('error');
        return;
      }

      if (json.result) {
        setTask(json.result);
        setState('done');
        onComplete?.();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      setErrorMsg(
        `Unable to send task. ${message}. Contact support@revealui.com if this persists.`,
      );
      setState('error');
    }
  }

  const responseText =
    task?.artifacts?.[0]?.parts
      .filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ??
    task?.status.message?.parts
      .filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="instruction" className="block text-sm font-medium text-zinc-300 mb-1.5">
          Send a task to <span className="text-white">{agentName}</span>
        </label>
        <textarea
          id="instruction"
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={`Tell ${agentName} what to do...`}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={state === 'submitting' || state === 'polling' || !instruction.trim()}
        className="self-start rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Sending...' : state === 'polling' ? 'Working...' : 'Send Task'}
      </button>

      {/* Status badge */}
      {task && (
        <div className="flex items-center gap-2">
          <TaskStateBadge state={task.status.state} />
          {task.id && (
            <span className="font-mono text-xs text-zinc-500">task:{task.id.slice(0, 8)}</span>
          )}
        </div>
      )}

      {/* Response */}
      {responseText && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Response</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-200">{responseText}</p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

function TaskStateBadge({ state }: { state: string }) {
  const configs: Record<string, { label: string; color: string }> = {
    submitted: { label: 'Submitted', color: 'bg-zinc-700 text-zinc-300' },
    working: { label: 'Working', color: 'bg-blue-500/10 text-blue-400' },
    'input-required': { label: 'Input Required', color: 'bg-yellow-500/10 text-yellow-400' },
    completed: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400' },
    canceled: { label: 'Canceled', color: 'bg-zinc-600 text-zinc-400' },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-400' },
    unknown: { label: 'Unknown', color: 'bg-zinc-700 text-zinc-400' },
  };
  const cfg = configs[state] ?? { label: state, color: 'bg-zinc-700 text-zinc-300' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
  );
}
