'use client';

import AgentChat from '@/lib/components/Agent';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <LicenseGate feature="ai">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-4 text-2xl font-bold">AI Chat</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Chat with the RevealUI AI assistant about your content, configuration, and tasks.
        </p>
        <AgentChat />
      </div>
    </LicenseGate>
  );
}
