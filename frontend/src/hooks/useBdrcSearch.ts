import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedState } from "@tanstack/react-pacer";
import { API_URL } from "@/config/api";
import { fetchTextByBdrcId } from "@/api/texts";
import type { OpenPechaText } from "@/types/text";

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

export function useBdrcSearch(searchQuery: string, type: string = "Work", debounceMs: number = 1000,callback: () => void | null=()=>{},enabled: boolean = true) {
  const [debouncedValue, setDebouncedValue, debouncer] = useDebouncedState(
    searchQuery,
    { wait: debounceMs }
  );
  useEffect(() => {
    setDebouncedValue(searchQuery);
  }, [searchQuery,setDebouncedValue]);
  const trimmedQuery = debouncedValue.trim();
  const isEnabled = trimmedQuery.length > 0 && enabled;

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
      if(data && callback){
        callback();
      }
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

export interface BdrcWorkAuthor {
  id: string | null;
  name: string;
}

export interface BdrcWorkInfo {
  workId: string;
  title: string;
  author: string;
  authors: BdrcWorkAuthor[];
}

/**
 * Fetch BDRC work by ID (title + authors). Use in async handlers.
 */
export async function fetchBdrcWork(workId: string): Promise<BdrcWorkInfo> {
  const res = await fetch(`${API_URL}/bdrc/works/${workId}`);
  if (!res.ok) throw new Error("Failed to fetch BDRC work");
  const data = await res.json();
  return {
    workId: data.workId ?? workId,
    title: data.title ?? "",
    author: data.author ?? "",
    authors: Array.isArray(data.authors) ? data.authors : [],
  };
}

/**
 * Fetch BDRC work by ID for display (title, authors). React Query hook.
 */
export function useBdrcWork(workId: string | null) {
  const { data, isLoading, error } = useQuery<BdrcWorkInfo>({
    queryKey: ["bdrc-work", workId],
    queryFn: () => fetchBdrcWork(workId!),
    enabled: Boolean(workId?.trim()),
    staleTime: 5 * 60 * 1000,
  });

  return {
    work: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Unknown error") : null,
  };
}

/**
 * Fetch catalog text by BDRC work ID (same pattern as useBdrcWork).
 * Returns the OpenPechaText if it exists in the catalog, or null.
 */
export function useTextByBdrcId(workId: string | null) {
  const { data, isLoading, isSuccess, isError, error, refetch } = useQuery<OpenPechaText | null>({
    queryKey: ["text-by-bdrc-id", workId],
    queryFn: () => fetchTextByBdrcId(workId!),
    enabled: Boolean(workId?.trim()),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  return {
    text: data ?? null,
    isLoading,
    isSuccess,
    isError,
    error: error ? (error instanceof Error ? error.message : "Unknown error") : null,
    refetch,
  };
}

