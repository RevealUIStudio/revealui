/**
 * useEpisodicMemory Hook
 *
 * React hook for managing episodic memory in client components.
 */

import type { AgentMemory } from "@revealui/contracts/agents";
import { useCallback, useEffect, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export interface UseEpisodicMemoryReturn {
	memories: AgentMemory[];
	addMemory: (memory: AgentMemory) => Promise<string>;
	removeMemory: (memoryId: string) => Promise<void>;
	getMemory: (memoryId: string) => AgentMemory | undefined;
	search: (query: string) => Promise<AgentMemory[]>;
	accessCount: number;
	isLoading: boolean;
	error: Error | null;
	refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for episodic memory management.
 *
 * @param userId - User identifier
 * @returns Episodic memory state and operations
 */
export function useEpisodicMemory(userId: string): UseEpisodicMemoryReturn {
	const [memories, setMemories] = useState<AgentMemory[]>([]);
	const [accessCount, setAccessCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	// Load initial state
	useEffect(() => {
		let mounted = true;

		async function load() {
			try {
				setIsLoading(true);
				setError(null);

				const response = await fetch(`/api/memory/episodic/${userId}`);
				if (!response.ok) {
					throw new Error(
						`Failed to load episodic memory: ${response.statusText}`,
					);
				}

				const data = await response.json();
				if (!mounted) return;

				setMemories(data.memories || []);
				setAccessCount(data.accessCount || 0);
			} catch (err) {
				if (!mounted) return;
				setError(err instanceof Error ? err : new Error("Unknown error"));
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		}

		load();

		return () => {
			mounted = false;
		};
	}, [userId]);

	// Refresh function
	const refresh = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetch(`/api/memory/episodic/${userId}`);
			if (!response.ok) {
				throw new Error(
					`Failed to refresh episodic memory: ${response.statusText}`,
				);
			}

			const data = await response.json();
			setMemories(data.memories || []);
			setAccessCount(data.accessCount || 0);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Unknown error"));
		} finally {
			setIsLoading(false);
		}
	}, [userId]);

	// Add memory
	const addMemory = useCallback(
		async (memory: AgentMemory): Promise<string> => {
			try {
				setError(null);
				const response = await fetch(`/api/memory/episodic/${userId}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(memory),
				});

				if (!response.ok) {
					throw new Error(`Failed to add memory: ${response.statusText}`);
				}

				const data = await response.json();

				// Refresh to get updated list
				await refresh();

				return data.tag || data.memoryId;
			} catch (err) {
				setError(err instanceof Error ? err : new Error("Unknown error"));
				throw err;
			}
		},
		[userId, refresh],
	);

	// Remove memory
	const removeMemory = useCallback(
		async (memoryId: string) => {
			try {
				setError(null);
				const response = await fetch(
					`/api/memory/episodic/${userId}/${memoryId}`,
					{
						method: "DELETE",
					},
				);

				if (!response.ok) {
					throw new Error(`Failed to remove memory: ${response.statusText}`);
				}

				// Refresh to get updated list
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err : new Error("Unknown error"));
				throw err;
			}
		},
		[userId, refresh],
	);

	// Get memory
	const getMemory = useCallback(
		(memoryId: string): AgentMemory | undefined => {
			return memories.find((m) => m.id === memoryId);
		},
		[memories],
	);

	// Search (placeholder - will use vector search when implemented)
	const search = useCallback(
		async (query: string): Promise<AgentMemory[]> => {
			// TODO: Implement vector search API endpoint
			// For now, just filter by content
			return memories.filter((m) =>
				m.content.toLowerCase().includes(query.toLowerCase()),
			);
		},
		[memories],
	);

	return {
		memories,
		addMemory,
		removeMemory,
		getMemory,
		search,
		accessCount,
		isLoading,
		error,
		refresh,
	};
}
