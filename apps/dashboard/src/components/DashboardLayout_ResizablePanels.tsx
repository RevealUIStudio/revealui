'use client'

import { useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { AgentPanel } from './AgentPanel.js'
import { ContentPanel } from './ContentPanel.js'
import { DataPanel } from './DataPanel.js'
import { SystemHealthPanel } from './SystemHealthPanel.js'

type BottomPanelTab = 'data' | 'health'

export function DashboardLayout() {
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>('data')

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

            {/* Bottom Panel - Data Visualization & System Health */}
            <Panel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col bg-gray-900">
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700">
                  <button
                    onClick={() => setBottomTab('data')}
                    type="button"
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      bottomTab === 'data'
                        ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Data & Analytics
                  </button>
                  <button
                    onClick={() => setBottomTab('health')}
                    type="button"
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      bottomTab === 'health'
                        ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    System Health
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                  {bottomTab === 'data' ? <DataPanel /> : <SystemHealthPanel />}
                </div>
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  )
}
