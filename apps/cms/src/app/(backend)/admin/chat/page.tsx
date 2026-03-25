'use client';

import AgentChat from '@/lib/components/Agent';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <LicenseGate feature="ai">
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <AgentChat />
      </div>
    </LicenseGate>
  );
}
