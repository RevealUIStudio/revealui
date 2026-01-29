'use client'

import { Group, Panel, Separator } from 'react-resizable-panels'
import { AgentPanel } from './AgentPanel.js'
import { ContentPanel } from './ContentPanel.js'
import { DataPanel } from './DataPanel.js'

export function DashboardLayout() {
  return (
    <div className="h-screen bg-gray-900 text-white overflow-hidden">
      <Group orientation="horizontal">
        {/* Left Panel - Agent Management (25%) */}
        <Panel defaultSize={25} minSize={20} maxSize={35}>
          <AgentPanel />
        </Panel>

        <Separator className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        {/* Right Panel - Content & Data (75%) */}
        <Panel defaultSize={75} minSize={65}>
          <Group orientation="vertical">
            {/* Top Panel - Live Preview/Content */}
            <Panel defaultSize={60} minSize={40}>
              <ContentPanel />
            </Panel>

            <Separator className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

            {/* Bottom Panel - Data Visualization */}
            <Panel defaultSize={40} minSize={25}>
              <DataPanel />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  )
}
