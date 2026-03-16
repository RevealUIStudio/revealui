import { useState } from 'react';
import type { WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepBlobProps {
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

export default function StepBlob({ data, onUpdateData, onNext }: StepBlobProps) {
  const [blobToken, setBlobToken] = useState(data.blobToken || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const trimmed = blobToken.trim();
    if (!trimmed) return;

    onUpdateData({ blobToken: trimmed });
    setSaved(true);
  }

  return (
    <WizardStep title="Blob Storage" description="Configure file storage for uploads.">
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4 text-sm text-neutral-400">
          <p className="mb-2 font-medium text-neutral-300">Setup instructions:</p>
          <ol className="list-inside list-decimal flex flex-col gap-1">
            <li>Open your Vercel project dashboard</li>
            <li>
              Go to <span className="text-neutral-200">Storage</span> tab
            </li>
            <li>
              Click <span className="text-neutral-200">Create Database</span> and select{' '}
              <span className="text-neutral-200">Blob</span>
            </li>
            <li>
              Copy the <span className="text-neutral-200">BLOB_READ_WRITE_TOKEN</span> from the
              environment variables
            </li>
          </ol>
        </div>

        <Input
          id="blob-token"
          label="BLOB_READ_WRITE_TOKEN"
          type="password"
          placeholder="vercel_blob_rw_..."
          value={blobToken}
          onChange={(e) => {
            setBlobToken(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
          mono
        />

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSave} disabled={!blobToken.trim() || saved}>
            Save Token
          </Button>

          {saved && <span className="text-sm text-green-400">Token saved</span>}
        </div>

        <Button variant="primary" onClick={onNext} disabled={!saved} className="mt-2 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
