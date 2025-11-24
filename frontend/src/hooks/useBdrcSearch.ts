import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from '@/config/api';

export interface BdrcContributor {
  creator?: string;
  agent?: string;
  agentName?: string;
  role?: string;
  roleName?: string;
}

export interface BdrcSearchResult {
  workId?: string;
  instanceId?: string;
  title?: string;
  catalogInfo?: string | null;
  contributors?: BdrcContributor[];
  language?: string | null;
  entityScore?: number | null;
  // Person-specific fields
  bdrc_id?: string;
  name?: string;
}

/**
 * Custom hook for searching BDRC entries using React Query
 * 
 * @param searchQuery - The search query string
 * @param type - The type to search for (Instance, Text, Person, etc.)
 * @param debounceMs - Debounce delay in milliseconds (default: 1000ms)
 * @returns search results and loading state
 */

export function useBdrcSearch(searchQuery: string, type: string = "Instance", debounceMs: number = 1000) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const trimmedQuery = debouncedQuery.trim();
  const isEnabled = trimmedQuery.length > 0;

  const { data, isLoading, error } = useQuery<BdrcSearchResult[]>({
    queryKey: ["bdrc-search", trimmedQuery, type],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_URL}/bdrc/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search_query: trimmedQuery,
          from: 0,
          size: 20,
          filter: [],
          type: type,
        }),
        signal, // AbortSignal will cancel the request when query is retriggered
      });

      if (!response.ok) {
        throw new Error("Failed to search BDRC entries");
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 1,
  });

  let errorMessage: string | null = null;
  if (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  return {
    results: data ?? [],
    isLoading,
    error: errorMessage,
  };
}

