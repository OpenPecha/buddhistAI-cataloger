import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedState } from '@tanstack/react-pacer';
import { searchBdrcOtWorksByTitle } from '../api';

/** Root key for BEC OT API work title searches; use with invalidateQueries. */
export const bdrcOtWorksSearchQueryKeyRoot = ['bdrc-ot-works-search'] as const;

export type BdrcOtWorkSearchHit = Record<string, unknown>;

export interface UseSearchBDRCOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Search BDRC works by title via BEC OT API (`/api/v1/works/search`), with debounced query + React Query.
 */
export function useSearchBDRC(
  searchQuery: string,
  { debounceMs = 1000, enabled = true }: UseSearchBDRCOptions = {}
) {
  const [debouncedValue, setDebouncedValue] = useDebouncedState(searchQuery, {
    wait: debounceMs,
  });
  useEffect(() => {
    setDebouncedValue(searchQuery);
  }, [searchQuery, setDebouncedValue]);

  const trimmedQuery = debouncedValue.trim();
  const isEnabled = trimmedQuery.length > 0 && enabled;

  const { data, isLoading, error } = useQuery<BdrcOtWorkSearchHit[]>({
    queryKey: [...bdrcOtWorksSearchQueryKeyRoot, trimmedQuery],
    queryFn: async ({ signal }) => {
      const rows = await searchBdrcOtWorksByTitle(trimmedQuery, { signal });
      return rows as BdrcOtWorkSearchHit[];
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  let errorMessage: string | null = null;
  if (error instanceof Error) errorMessage = error.message;
  else if (error) errorMessage = 'Unknown error';

  return {
    results: data ?? [],
    isLoading,
    error: errorMessage,
  };
}
