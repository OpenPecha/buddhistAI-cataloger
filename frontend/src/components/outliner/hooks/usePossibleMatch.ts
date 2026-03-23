import { useQuery } from '@tanstack/react-query'
import { findMatchingBdrcWork, type BdrcMatchingSuggestion } from '@/api/bdrc'
import type { TextSegment } from '../types'

export interface UsePossibleMatchResult {
  suggestions: BdrcMatchingSuggestion[]
  loading: boolean
  error: string | null
}

/**
 * BDRC OTAPI duplicate suggestions for the current segment span (POST /bdrc/matching/find-work).
 */
export function usePossibleMatch(
  segment: TextSegment | undefined,
  volumeId: string | undefined,
  disabled: boolean
): UsePossibleMatchResult {
  const volumeIdTrimmed = volumeId?.trim() ?? ''
  const canFetch = Boolean(segment) && !disabled && volumeIdTrimmed.length > 0

  const text = segment?.text ?? ''
  const cstart = segment?.span_start ?? 0
  const cend = segment?.span_end ?? text.length

  const query = useQuery({
    queryKey: [
      'bdrc-matching-find-work',
      volumeIdTrimmed,
      text,
      cstart,
      cend,
    ] as const,
    queryFn: ({ signal }) =>
      findMatchingBdrcWork(
        {
          text_bo: text,
          volume_id: volumeIdTrimmed,
          cstart,
          cend,
        },
        { signal }
      ),
    enabled: canFetch,
    staleTime: 60_000,
    retry: 1,
  })

  const suggestions = canFetch ? (query.data ?? []) : []
  const loading = canFetch && query.isFetching

  let error: string | null = null
  if (canFetch && query.isError) {
    error =
      query.error instanceof Error
        ? query.error.message
        : 'Failed to load suggestions'
  }

  return { suggestions, loading, error }
}
