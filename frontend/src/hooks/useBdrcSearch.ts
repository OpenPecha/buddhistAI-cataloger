import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

export interface BdrcSearchResult {
  workId: string;
  instanceId: string;
  prefLabel: string;
  catalogInfo: string | null;
  creator: string | null;
  language: string | null;
  workGenre: string | null;
  workHasInstance: string[];
  entityScore: number | null;
}

/**
 * Custom hook for searching BDRC entries
 * 
 * @param searchQuery - The search query string
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns search results and loading state
 */
export function useBdrcSearch(searchQuery: string, debounceMs: number = 500) {
  const [results, setResults] = useState<BdrcSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If search query is empty, reset results
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Set loading immediately
    setIsLoading(true);
    setError(null);

    // Debounce API call
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/bdrc/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            search_query: searchQuery.trim(),
            from: 0,
            size: 20,
            filter: [],
            type: "Instance",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to search BDRC entries");
        }

        const data = await response.json();
        setResults(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  return {
    results,
    isLoading,
    error,
  };
}

