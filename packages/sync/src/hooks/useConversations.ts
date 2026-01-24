"use client";

import { useShape } from "@electric-sql/react";

export function useConversations(userId: string) {
  const { data, isLoading, error } = useShape({
    url: `/api/shapes/conversations`,
    params: {
      table: "conversations",
      where: `user_id = '${userId}'`,
    },
  });

  return {
    conversations: (data as any[]) || [],
    isLoading,
    error: error as Error | null,
  };
}