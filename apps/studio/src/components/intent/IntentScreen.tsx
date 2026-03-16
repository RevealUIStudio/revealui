import { useState } from 'react';
import Button from '../ui/Button';

interface IntentScreenProps {
  onSelect: (intent: 'deploy' | 'develop') => void;
}

export default function IntentScreen({ onSelect }: IntentScreenProps) {
  const [selected, setSelected] = useState<'deploy' | 'develop' | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-2xl px-8">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-2xl font-bold text-white">
            R
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to RevealUI Studio</h1>
          <p className="mt-2 text-neutral-400">How would you like to use RevealUI?</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => setSelected('deploy')}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selected === 'deploy'
                ? 'border-orange-500 bg-neutral-800'
                : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
          >
            <div className="mb-2 text-2xl">&#x1F680;</div>
            <h2 className="text-lg font-semibold text-white">Deploy</h2>
            <p className="mt-1 text-sm text-neutral-400">
              I want to run RevealUI for my business. Set up Vercel, database, Stripe, and go live.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected('develop')}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selected === 'develop'
                ? 'border-orange-500 bg-neutral-800'
                : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
          >
            <div className="mb-2 text-2xl">&#x1F6E0;&#xFE0F;</div>
            <h2 className="text-lg font-semibold text-white">Develop</h2>
            <p className="mt-1 text-sm text-neutral-400">
              I want to contribute to RevealUI. Set up the dev environment with WSL, Nix, and tools.
            </p>
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
