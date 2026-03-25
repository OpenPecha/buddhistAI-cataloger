import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedState } from '@tanstack/react-pacer';
import { fetchBdrcOtWorks, type BdrcOtWorksQueryParams } from '../api/work';

/** Root key for BEC OT API work list queries; use with invalidateQueries. */
export const bdrcOtWorksSearchQueryKeyRoot = ['bdrc-ot-works-search'] as const;

export type BdrcOtWorkSearchHit = Record<string, unknown>;

export interface BdrcOtWorksListFilters {
  prefLabelBo: string;
  /** Annotator email sent as `modified_by`. */
  modifiedByEmail: string;
  recordOrigin: string;
  recordStatus: string;
  /** BDRC person id for `author_id`. */
  authorId: string;
  page: number;
  pageSize: number;
}

export interface UseSearchBDRCOptions {
  debounceMs?: number;
  enabled?: boolean;
}

function buildQueryParams(
  debouncedPref: string,
  modifiedByEmail: string,
  recordOrigin: string,
  recordStatus: string,
  authorId: string,
  page: number,
  pageSize: number
): BdrcOtWorksQueryParams {
  const pref = debouncedPref.trim();
  const mod = modifiedByEmail.trim();
  const origin = recordOrigin.trim();
  const status = recordStatus.trim();
  const aid = authorId.trim();
  const safePage = Math.max(1, page);
  const size = Math.min(200, Math.max(1, pageSize));
  return {
    pref_label_bo: pref || undefined,
    modified_by: mod || undefined,
    record_origin: origin || undefined,
    record_status: status || undefined,
    author_id: aid || undefined,
    offset: (safePage - 1) * size,
    limit: size,
  };
}

/**
 * List / filter BDRC works via BEC OT API (`GET /api/v1/works`), with debounced title + React Query.
 */
export function useSearchBDRC(
  filters: BdrcOtWorksListFilters,
  { debounceMs = 600, enabled = true }: UseSearchBDRCOptions = {}
) {
  const [debouncedPref, setDebouncedPref] = useDebouncedState(filters.prefLabelBo, {
    wait: debounceMs,
  });

  useEffect(() => {
    setDebouncedPref(filters.prefLabelBo);
  }, [filters.prefLabelBo, setDebouncedPref]);

  const queryParams = useMemo(
    () =>
      buildQueryParams(
        debouncedPref,
        filters.modifiedByEmail,
        filters.recordOrigin,
        filters.recordStatus,
        filters.authorId,
        filters.page,
        filters.pageSize
      ),
    [
      debouncedPref,
      filters.modifiedByEmail,
      filters.recordOrigin,
      filters.recordStatus,
      filters.authorId,
      filters.page,
      filters.pageSize,
    ]
  );

  const queryKey = useMemo(
    () => [...bdrcOtWorksSearchQueryKeyRoot, queryParams] as const,
    [queryParams]
  );

  const { data, isLoading, error, isFetching } = useQuery<BdrcOtWorkSearchHit[]>({
    queryKey,
    queryFn: async ({ signal }) => {
      const rows = await fetchBdrcOtWorks(queryParams, { signal });
      return rows as BdrcOtWorkSearchHit[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  let errorMessage: string | null = null;
  if (error instanceof Error) errorMessage = error.message;
  else if (error) errorMessage = 'Unknown error';

  return {
    results: data ?? [],
    isLoading,
    isFetching,
    error: errorMessage,
  };
}
