'use client';

import { Button, Card, Select, Textarea } from '@revealui/presentation';
import { useState } from 'react';

export type DiagramExportPurpose = 'consultation_sketch' | 'launch_architecture';
export type DiagramExportTheme = 'minimal' | 'rev';

export interface DiagramExportPanelProps {
  repo: string;
  selection: string[];
}

interface DiagramSuccess {
  mermaid: string;
  svg?: string;
  png?: string;
  graphHash: string;
  graphVersion: string;
  theme: string;
  honesty?: string;
}

export function DiagramExportPanel({ repo, selection }: DiagramExportPanelProps) {
  const [purpose, setPurpose] = useState<DiagramExportPurpose>('consultation_sketch');
  const [theme, setTheme] = useState<DiagramExportTheme>('minimal');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagramSuccess | null>(null);

  async function handleExport() {
    setStatus('loading');
    setError(null);
    try {
      const response = await fetch('/api/kg/diagram', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repo.length > 0 ? repo : undefined,
          selection: selection.length > 0 ? selection : undefined,
          format: ['mermaid', 'svg', 'png'],
          purpose,
          view: '2d',
          theme,
        }),
      });
      const data = (await response.json()) as DiagramSuccess & { message?: string };
      if (!response.ok) {
        setStatus('error');
        setError(data.message ?? 'Diagram export failed.');
        return;
      }
      setResult(data);
      setStatus('ready');
    } catch {
      setStatus('error');
      setError('Diagram export failed.');
    }
  }

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-sm font-medium text-foreground">RevMind export</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Architecture from your knowledge graph — Mermaid is the source of truth. Not a public
          Architecture SKU.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-56">
            <label htmlFor="revmind-purpose" className="text-xs text-muted-foreground">
              Purpose
            </label>
            <Select
              id="revmind-purpose"
              aria-label="Diagram purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as DiagramExportPurpose)}
            >
              <option value="consultation_sketch">Consultation sketch (capped)</option>
              <option value="launch_architecture">Launch architecture (licensed)</option>
            </Select>
          </div>
          <div className="w-40">
            <label htmlFor="revmind-theme" className="text-xs text-muted-foreground">
              Theme
            </label>
            <Select
              id="revmind-theme"
              aria-label="Diagram theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as DiagramExportTheme)}
            >
              <option value="minimal">Minimal</option>
              <option value="rev">Rev</option>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={status === 'loading'}>
            {status === 'loading' ? 'Exporting…' : 'Export diagram'}
          </Button>
        </div>
        {status === 'error' && error && (
          <p className="mt-2 text-xs text-error" role="alert">
            {error}
          </p>
        )}
        {status === 'ready' && result && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              graph {result.graphVersion} · {result.graphHash.slice(0, 12)} · {result.theme}
            </p>
            <Textarea
              aria-label="Mermaid source"
              readOnly
              rows={8}
              value={result.mermaid}
              className="font-mono text-xs"
            />
            {result.svg && (
              <a
                className="text-xs text-primary underline"
                href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
                download={`revmind-${theme}.svg`}
              >
                Download SVG
              </a>
            )}
            {result.png && (
              <a
                className="text-xs text-primary underline"
                href={`data:image/png;base64,${result.png}`}
                download={`revmind-${theme}.png`}
              >
                Download PNG
              </a>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
