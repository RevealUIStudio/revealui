"use client";

import { logger } from "@revealui/core/utils/logger";
import type { JSX } from "react";
import { useState } from "react";

interface Component {
	id: string;
	type: "text" | "button" | "image" | "container";
	content?: string;
	src?: string;
	children?: Component[];
}

export function Builder(): JSX.Element {
	const [components, setComponents] = useState<Component[]>([
		{
			id: "root",
			type: "container",
			children: [],
		},
	]);

	const [selectedComponent, setSelectedComponent] = useState<string | null>(
		null,
	);
	const [showAI, setShowAI] = useState(false);

	// Generate a unique ID using crypto.randomUUID if available, fallback to timestamp + random
	const generateId = (): string => {
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	};

	const addComponent = (type: Component["type"]) => {
		const newComponent: Component = {
			id: generateId(),
			type,
			content:
				type === "text"
					? "New text"
					: type === "button"
						? "Click me"
						: undefined,
			children: type === "container" ? [] : undefined,
		};

		setComponents((prev) => {
			const updateComponents = (comps: Component[]): Component[] => {
				return comps.map((comp) => {
					if (comp.id === selectedComponent && comp.type === "container") {
						return {
							...comp,
							children: [...(comp.children || []), newComponent],
						};
					}
					if (comp.children) {
						return {
							...comp,
							children: updateComponents(comp.children),
						};
					}
					return comp;
				});
			};
			return updateComponents(prev);
		});
	};

	const renderComponent = (component: Component): JSX.Element => {
		switch (component.type) {
			case "text":
				return (
					<button
						type="button"
						tabIndex={0}
						key={component.id}
						className={`p-2 border-2 ${selectedComponent === component.id ? "border-blue-500" : "border-transparent"}`}
						onClick={() => {
							setSelectedComponent(component.id);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSelectedComponent(component.id);
							}
						}}
					>
						{component.content}
					</button>
				);
			case "button":
				return (
					<button
						type="button"
						key={component.id}
						className={`btn ${selectedComponent === component.id ? "ring-2 ring-blue-500" : ""}`}
						onClick={() => {
							setSelectedComponent(component.id);
						}}
					>
						{component.content}
					</button>
				);
			case "image":
				return (
					<button
						type="button"
						tabIndex={0}
						key={component.id}
						className={`max-w-full inline-block border-2 ${selectedComponent === component.id ? "border-blue-500" : "border-transparent"}`}
						onClick={() => {
							setSelectedComponent(component.id);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSelectedComponent(component.id);
							}
						}}
					>
						{/* biome-ignore lint/performance/noImgElement: Using img for dynamic user-provided images */}
						<img
							src={component.src || "/placeholder.jpg"}
							alt="Component"
							className="max-w-full h-auto"
						/>
					</button>
				);
			case "container":
				return (
					<button
						type="button"
						tabIndex={0}
						key={component.id}
						className={`min-h-[100px] border-2 border-dashed border-gray-300 p-4 ${selectedComponent === component.id ? "border-blue-500" : ""}`}
						onClick={() => {
							setSelectedComponent(component.id);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSelectedComponent(component.id);
							}
						}}
					>
						{component.children?.map(renderComponent)}
					</button>
				);
			default:
				return <div key={component.id}>Unknown component</div>;
		}
	};

	const updateComponentContent = (content: string) => {
		setComponents((prev) => {
			const updateComponents = (comps: Component[]): Component[] => {
				return comps.map((comp) => {
					if (comp.id === selectedComponent) {
						return { ...comp, content };
					}
					if (comp.children) {
						return {
							...comp,
							children: updateComponents(comp.children),
						};
					}
					return comp;
				});
			};
			return updateComponents(prev);
		});
	};

	const exportProject = () => {
		const projectData = {
			components,
			exportedAt: new Date().toISOString(),
			version: "0.1.0",
		};
		const blob = new Blob([JSON.stringify(projectData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "revealui-project.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const deployToVercel = () => {
		// NOTE: This is an experimental/prototype feature
		// For production, implement actual Vercel API integration
		logger.warn(
			"Deploy functionality is not yet implemented. This is a prototype feature.",
		);
		// TODO: Implement Vercel API integration
		// - Authenticate with Vercel
		// - Create project
		// - Deploy components
		// - Return deployment URL
	};

	const selectedComp =
		components.find((c) => c.id === selectedComponent) ||
		components
			.flatMap((c) => c.children || [])
			.find((c) => c.id === selectedComponent);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
			{/* Toolbar */}
			<div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6">
				<h2 className="text-lg font-semibold mb-4">Components</h2>
				<div className="space-y-2">
					<button
						type="button"
						onClick={() => {
							addComponent("text");
						}}
						className="w-full btn bg-green-600 hover:bg-green-700"
					>
						Add Text
					</button>
					<button
						type="button"
						onClick={() => {
							addComponent("button");
						}}
						className="w-full btn bg-blue-600 hover:bg-blue-700"
					>
						Add Button
					</button>
					<button
						type="button"
						onClick={() => {
							addComponent("image");
						}}
						className="w-full btn bg-purple-600 hover:bg-purple-700"
					>
						Add Image
					</button>
					<button
						type="button"
						onClick={() => {
							addComponent("container");
						}}
						className="w-full btn bg-gray-600 hover:bg-gray-700"
					>
						Add Container
					</button>
				</div>

				<div className="mt-8 space-y-2">
					<button
						type="button"
						onClick={exportProject}
						className="w-full btn bg-green-600 hover:bg-green-700"
					>
						💾 Export Project
					</button>
					<button
						type="button"
						onClick={() => {
							deployToVercel();
						}}
						className="w-full btn bg-orange-600 hover:bg-orange-700 text-lg font-semibold"
					>
						🚀 Deploy to Vercel
					</button>
				</div>
			</div>

			{/* Properties Panel */}
			{selectedComponent && selectedComp ? (
				<div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6">
					<h2 className="text-lg font-semibold mb-4">Properties</h2>
					<div className="space-y-4">
						<div>
							<div className="block text-sm font-medium text-gray-700 mb-1">
								Component Type
							</div>
							<div className="px-3 py-2 bg-gray-100 rounded text-sm capitalize">
								{selectedComp.type}
							</div>
						</div>

						{selectedComp.type === "text" || selectedComp.type === "button" ? (
							<div>
								<label
									htmlFor="content-textarea"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Content
								</label>
								<textarea
									id="content-textarea"
									value={selectedComp.content || ""}
									onChange={(e) => {
										updateComponentContent(e.target.value);
									}}
									className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
									rows={3}
									placeholder="Enter content..."
								/>
							</div>
						) : null}

						{selectedComp.type === "image" ? (
							<div>
								<label
									htmlFor="image-url-input"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Image URL
								</label>
								<input
									id="image-url-input"
									type="url"
									value={selectedComp.src || ""}
									onChange={(e) => {
										setComponents((prev) => {
											const updateComponents = (
												comps: Component[],
											): Component[] => {
												return comps.map((comp) => {
													if (comp.id === selectedComponent) {
														return { ...comp, src: e.target.value };
													}
													if (comp.children) {
														return {
															...comp,
															children: updateComponents(comp.children),
														};
													}
													return comp;
												});
											};
											return updateComponents(prev);
										});
									}}
									className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
									placeholder="https://example.com/image.jpg"
								/>
							</div>
						) : null}
					</div>
				</div>
			) : null}

			{/* Canvas */}
			<div
				className={`${selectedComponent ? "lg:col-span-3" : "lg:col-span-4"} bg-white rounded-lg shadow-lg p-6`}
			>
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-lg font-semibold">Canvas</h2>
					<button
						type="button"
						onClick={() => {
							setShowAI(!showAI);
						}}
						className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
					>
						🤖 {showAI ? "Hide" : "Show"} AI Assistant
					</button>
				</div>

				{showAI ? (
					<div className="mb-4 border border-purple-200 rounded-lg p-4 bg-purple-50">
						<h3 className="text-sm font-semibold text-purple-800 mb-2">
							RevealUI AI Assistant
						</h3>
						<p className="text-sm text-purple-700 mb-2">
							🤖 AI features coming soon! Configure your API key to enable
							intelligent assistance.
						</p>
						<div className="bg-white border border-purple-300 rounded p-3 text-center">
							<p className="text-sm text-gray-600">
								AI chat interface will be available here
							</p>
						</div>
					</div>
				) : null}

				<div className="border-2 border-gray-200 rounded-lg p-4 min-h-[400px]">
					{components.map(renderComponent)}
				</div>
			</div>
		</div>
	);
}
