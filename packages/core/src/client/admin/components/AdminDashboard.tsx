"use client";

import { logger } from "@revealui/core/utils/logger";
import { useEffect, useState } from "react";
import type {
	RevealCollectionConfig,
	RevealConfig,
	RevealDocument,
} from "../../../types/index.js";
import { APIError, APIErrorType, apiClient } from "../utils/index.js";
import { CollectionList } from "./CollectionList.js";
import { DocumentForm } from "./DocumentForm.js";

interface AdminDashboardProps {
	config: RevealConfig;
}

type ViewType = "dashboard" | "collection" | "edit";

interface CurrentView {
	type: ViewType;
	collection?: RevealCollectionConfig;
	document?: RevealDocument;
}

export function AdminDashboard({ config }: AdminDashboardProps) {
	const [currentView, setCurrentView] = useState<CurrentView>({
		type: "dashboard",
	});
	const [collectionData, setCollectionData] = useState<{
		documents: RevealDocument[];
		totalDocs: number;
		page: number;
		totalPages: number;
		loading: boolean;
		error: string | null;
	}>({
		documents: [],
		totalDocs: 0,
		page: 1,
		totalPages: 1,
		loading: false,
		error: null,
	});
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const collections = config.collections || [];
	const globals = config.globals || [];

	// Auto-dismiss success messages
	useEffect(() => {
		if (successMessage) {
			const timer = setTimeout(() => setSuccessMessage(null), 3000);
			return () => clearTimeout(timer);
		}
	}, [successMessage]);

	// Auto-dismiss error messages
	useEffect(() => {
		if (error) {
			const timer = setTimeout(() => setError(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [error]);

	const handleCollectionClick = async (collection: RevealCollectionConfig) => {
		setCurrentView({ type: "collection", collection });
		setError(null);
		setSuccessMessage(null);

		try {
			// Show loading state
			setCollectionData((prev) => ({ ...prev, loading: true, error: null }));

			// Fetch first page of documents
			const response = await apiClient.find({
				collection: String(collection.slug),
				page: 1,
				limit: 10,
			});

			setCollectionData({
				documents: response.docs || [],
				totalDocs: response.totalDocs || 0,
				page: response.page || 1,
				totalPages: response.totalPages || 1,
				loading: false,
				error: null,
			});
		} catch (err: unknown) {
			// Handle error
			const errorMessage =
				err instanceof APIError
					? err.message
					: "Failed to fetch collection data. Please try again.";
			logger.error("Failed to fetch collection data", { error: err });
			setCollectionData((prev) => ({
				...prev,
				loading: false,
				error: errorMessage,
			}));
			setError(errorMessage);

			// Handle authentication errors
			if (err instanceof APIError && err.type === APIErrorType.AUTHENTICATION) {
				// Redirect to login would be handled by the auth system
				logger.warn("Authentication required");
			}
		}
	};

	const handleCreate = (): void => {
		if (currentView.collection) {
			setCurrentView({ type: "edit", collection: currentView.collection });
		}
	};

	const handleEdit = (document: RevealDocument): void => {
		if (currentView.collection) {
			setCurrentView({
				type: "edit",
				collection: currentView.collection,
				document,
			});
		}
	};

	const handleDelete = async (document: RevealDocument) => {
		if (!currentView.collection || !document.id) return;

		// Show confirmation dialog
		const confirmed = window.confirm(
			`Are you sure you want to delete this ${String(currentView.collection.slug)}? This action cannot be undone.`,
		);

		if (!confirmed) return;

		try {
			setDeleting(String(document.id));
			setError(null);
			setSuccessMessage(null);

			await apiClient.delete({
				collection: String(currentView.collection.slug),
				id: String(document.id),
			});

			// Refresh collection list
			if (currentView.collection) {
				await handleCollectionClick(currentView.collection);
			}

			// Show success message
			setSuccessMessage("Document deleted successfully");
		} catch (err: unknown) {
			const errorMessage =
				err instanceof APIError
					? err.message
					: "Failed to delete document. Please try again.";
			logger.error("Failed to delete document", { error: err });
			setError(errorMessage);

			// Handle authentication errors
			if (err instanceof APIError && err.type === APIErrorType.AUTHENTICATION) {
				logger.warn("Authentication required");
			}
		} finally {
			setDeleting(null);
		}
	};

	const handleSave = async (data: Record<string, any>) => {
		if (!currentView.collection) return;

		try {
			setSaving(true);
			setError(null);
			setSuccessMessage(null);

			if (currentView.document?.id) {
				// Update existing document
				await apiClient.update({
					collection: String(currentView.collection.slug),
					id: String(currentView.document.id),
					data,
				});
				setSuccessMessage("Document updated successfully");
			} else {
				// Create new document
				await apiClient.create({
					collection: String(currentView.collection.slug),
					data,
				});
				setSuccessMessage("Document created successfully");
			}

			// Refresh collection list
			if (currentView.collection) {
				await handleCollectionClick(currentView.collection);
			}

			// Navigate back to collection view
			setCurrentView({
				type: "collection",
				collection: currentView.collection,
			});
		} catch (err: unknown) {
			const errorMessage =
				err instanceof APIError
					? err.message
					: "Failed to save document. Please try again.";
			logger.error("Failed to save document", { error: err });
			setError(errorMessage);

			// Handle validation errors
			if (err instanceof APIError && err.type === APIErrorType.VALIDATION) {
				// Validation errors are already in the error message
				logger.warn("Validation error", {
					field: err.field,
					message: err.message,
				});
			}

			// Handle authentication errors
			if (err instanceof APIError && err.type === APIErrorType.AUTHENTICATION) {
				logger.warn("Authentication required");
			}
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		setCurrentView({ type: "dashboard" });
	};

	const handlePageChange = async (page: number) => {
		if (!currentView.collection) return;

		try {
			setCollectionData((prev) => ({ ...prev, loading: true, error: null }));

			const response = await apiClient.find({
				collection: String(currentView.collection.slug),
				page,
				limit: 10,
			});

			setCollectionData({
				documents: response.docs || [],
				totalDocs: response.totalDocs || 0,
				page: response.page || 1,
				totalPages: response.totalPages || 1,
				loading: false,
				error: null,
			});
		} catch (err: unknown) {
			const errorMessage =
				err instanceof APIError
					? err.message
					: "Failed to fetch page. Please try again.";
			logger.error("Failed to fetch page", { error: err });
			setCollectionData((prev) => ({
				...prev,
				loading: false,
				error: errorMessage,
			}));
			setError(errorMessage);
		}
	};

	if (currentView.type === "collection" && currentView.collection) {
		return (
			<div className="min-h-screen bg-gray-50">
				<header className="bg-white shadow-sm border-b">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center py-4">
							<div className="flex items-center space-x-4">
								<button
									type="button"
									onClick={() => setCurrentView({ type: "dashboard" })}
									className="text-gray-400 hover:text-gray-600"
								>
									← Back to Dashboard
								</button>
								<h1 className="text-2xl font-bold text-gray-900 capitalize">
									{String(currentView.collection.slug)}
								</h1>
							</div>
						</div>
					</div>
				</header>

				<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					{/* Error Message */}
					{error && (
						<div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
							<p className="font-medium">Error</p>
							<p className="text-sm">{error}</p>
						</div>
					)}

					{/* Success Message */}
					{successMessage && (
						<div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
							<p className="font-medium">Success</p>
							<p className="text-sm">{successMessage}</p>
						</div>
					)}

					{/* Loading State */}
					{collectionData.loading && (
						<div className="mb-4 text-center py-8">
							<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
							<p className="mt-2 text-sm text-gray-600">Loading...</p>
						</div>
					)}

					<CollectionList
						collection={currentView.collection}
						documents={collectionData.documents}
						totalDocs={collectionData.totalDocs}
						page={collectionData.page}
						totalPages={collectionData.totalPages}
						onCreate={handleCreate}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onPageChange={handlePageChange}
						deleting={deleting}
					/>
				</main>
			</div>
		);
	}

	if (currentView.type === "edit" && currentView.collection) {
		return (
			<div className="min-h-screen bg-gray-50">
				<header className="bg-white shadow-sm border-b">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center py-4">
							<div className="flex items-center space-x-4">
								<button
									type="button"
									onClick={() => setCurrentView({ type: "dashboard" })}
									className="text-gray-400 hover:text-gray-600"
								>
									← Back to Dashboard
								</button>
								<h1 className="text-2xl font-bold text-gray-900 capitalize">
									{currentView.document ? "Edit" : "Create"}{" "}
									{String(currentView.collection.slug).slice(0, -1)}
								</h1>
							</div>
						</div>
					</div>
				</header>

				<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="max-w-3xl">
						{/* Error Message */}
						{error && (
							<div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
								<p className="font-medium">Error</p>
								<p className="text-sm">{error}</p>
							</div>
						)}

						{/* Success Message */}
						{successMessage && (
							<div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
								<p className="font-medium">Success</p>
								<p className="text-sm">{successMessage}</p>
							</div>
						)}

						<DocumentForm
							collection={currentView.collection}
							document={currentView.document}
							onSave={handleSave}
							onCancel={handleCancel}
							isLoading={saving}
						/>
					</div>
				</main>
			</div>
		);
	}

	// Dashboard view
	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-4">
						<div className="flex items-center">
							<h1 className="text-2xl font-bold text-gray-900">
								RevealUI Admin
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<span className="text-sm text-gray-500">v0.1.0</span>
						</div>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="px-4 py-6 sm:px-0">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{/* Collections */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<svg
											className="h-8 w-8 text-gray-400"
											aria-label="Collections"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											role="img"
										>
											<title>Collections</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
											/>
										</svg>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												Collections
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{collections.length}
											</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm">
									{collections.length > 0 ? (
										<ul className="space-y-1">
											{collections.slice(0, 3).map((collection) => (
												<li
													key={String(collection.slug)}
													className="text-gray-600 hover:text-gray-900"
												>
													<button
														type="button"
														onClick={() => handleCollectionClick(collection)}
														className="hover:underline cursor-pointer"
													>
														{String(collection.slug)}
													</button>
												</li>
											))}
											{collections.length > 3 && (
												<li className="text-gray-400">
													+{collections.length - 3} more
												</li>
											)}
										</ul>
									) : (
										<p className="text-gray-500">No collections configured</p>
									)}
								</div>
							</div>
						</div>

						{/* Globals */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<svg
											className="h-8 w-8 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-labelledby="globals-icon-title"
											role="img"
										>
											<title id="globals-icon-title">Globals</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
											/>
										</svg>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												Globals
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{globals.length}
											</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm">
									{globals.length > 0 ? (
										<ul className="space-y-1">
											{globals.slice(0, 3).map((global) => (
												<li key={String(global.slug)} className="text-gray-600">
													{String(global.slug)}
												</li>
											))}
											{globals.length > 3 && (
												<li className="text-gray-400">
													+{globals.length - 3} more
												</li>
											)}
										</ul>
									) : (
										<p className="text-gray-500">No globals configured</p>
									)}
								</div>
							</div>
						</div>

						{/* System Status */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
											<svg
												className="h-5 w-5 text-green-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-labelledby="system-status-icon-title"
												role="img"
											>
												<title id="system-status-icon-title">
													System Status: Healthy
												</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												System Status
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												Healthy
											</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm text-gray-600">
									RevealUI CMS is running successfully
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
