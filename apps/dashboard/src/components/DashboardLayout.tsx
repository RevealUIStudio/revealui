"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AgentPanel } from "./AgentPanel";
import { ContentPanel } from "./ContentPanel";
import { DataPanel } from "./DataPanel";

export function DashboardLayout() {
	return (
		<div className="h-screen bg-gray-900 text-white overflow-hidden">
			<PanelGroup direction="horizontal">
				{/* Left Panel - Agent Management (25%) */}
				<Panel defaultSize={25} minSize={20} maxSize={35}>
					<AgentPanel />
				</Panel>

				<PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

				{/* Right Panel - Content & Data (75%) */}
				<Panel defaultSize={75} minSize={65}>
					<PanelGroup direction="vertical">
						{/* Top Panel - Live Preview/Content */}
						<Panel defaultSize={60} minSize={40}>
							<ContentPanel />
						</Panel>

						<PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

						{/* Bottom Panel - Data Visualization */}
						<Panel defaultSize={40} minSize={25}>
							<DataPanel />
						</Panel>
					</PanelGroup>
				</Panel>
			</PanelGroup>
		</div>
	);
}
