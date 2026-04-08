'use client';

import { LicenseGate } from '@/lib/components/LicenseGate';
import { SystemHealthMonitor } from '@/lib/components/SystemHealthMonitor';

export default function MonitoringPage() {
  return (
    <LicenseGate feature="dashboard">
      <div className="min-h-screen">
        <div className="p-4 border-b border-gray-700 bg-gray-900">
          <h1 className="text-xl font-semibold text-white">System Monitoring</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time system health, process tracking, and database pool metrics
          </p>
        </div>
        <SystemHealthMonitor />
      </div>
    </LicenseGate>
  );
}
