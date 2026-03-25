import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedState } from '@tanstack/react-pacer';
import {
  fetchBdrcOtPersons,
  type BdrcOtPersonsListResponse,
  type BdrcOtPersonsQueryParams,
} from '../api/persons';

/** Root key for BEC OT API person list queries; use with invalidateQueries. */
export const bdrcOtPersonsSearchQueryKeyRoot = [
  'bdrc-ot-persons-search',
] as const;

export interface BdrcOtPersonsListFilters {
  prefLabelBo: string;
  /** Annotator email sent as `modified_by`. */
  modifiedByEmail: string;
  recordOrigin: string;
  recordStatus: string;
  page: number;
  pageSize: number;
}

export interface UseSearchBDRCPersonsOptions {
  debounceMs?: number;
  enabled?: boolean;
}

function buildQueryParams(
  debouncedPref: string,
  modifiedByEmail: string,
  recordOrigin: string,
  recordStatus: string,
  page: number,
  pageSize: number
): BdrcOtPersonsQueryParams {
  const pref = debouncedPref.trim();
  const mod = modifiedByEmail.trim();
  const origin = recordOrigin.trim();
  const status = recordStatus.trim();
  const safePage = Math.max(1, page);
  const size = Math.min(200, Math.max(1, pageSize));
  return {
    pref_label_bo: pref || undefined,
    modified_by: mod || undefined,
    record_origin: origin || undefined,
    record_status: status || undefined,
    offset: (safePage - 1) * size,
    limit: size,
  };
}

/**
 * List / filter BDRC persons via BEC OT API (`GET /api/v1/persons`), with debounced title + React Query.
 */
export function useSearchBDRCPersons(
  filters: BdrcOtPersonsListFilters,
  { debounceMs = 600, enabled = true }: UseSearchBDRCPersonsOptions = {}
) {
  const [debouncedPref, setDebouncedPref] = useDebouncedState(
    filters.prefLabelBo,
    { wait: debounceMs }
  );

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
        filters.page,
        filters.pageSize
      ),
    [
      debouncedPref,
      filters.modifiedByEmail,
      filters.recordOrigin,
      filters.recordStatus,
      filters.page,
      filters.pageSize,
    ]
  );

  const queryKey = useMemo(
    () => [...bdrcOtPersonsSearchQueryKeyRoot, queryParams] as const,
    [queryParams]
  );

  const { data, isLoading, error, isFetching } =
    useQuery<BdrcOtPersonsListResponse>({
      queryKey,
      queryFn: async ({ signal }) => fetchBdrcOtPersons(queryParams, { signal }),
      enabled,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    });

  let errorMessage: string | null = null;
  if (error instanceof Error) errorMessage = error.message;
  else if (error) errorMessage = 'Unknown error';

  return {
    results: data?.items ?? [],
    total: data?.total ?? 0,
    offset: data?.offset ?? 0,
    limit: data?.limit ?? filters.pageSize,
    isLoading,
    isFetching,
    error: errorMessage,
  };
}
