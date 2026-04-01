import { useQuery } from '@tanstack/react-query';
import {
  fetchBdrcOtVolume,
  type BdrcOtVolumeDetail,
} from '../api/volume';

export const bdrcOtVolumeQueryKeyRoot = ['bdrc-ot-volume'] as const;

/**
 * Fetch a single volume by `volume_id` (React Query).
 */
export function useBdrcOtVolume(volumeId: string | null | undefined) {
  const trimmed = volumeId?.trim() ?? '';
  const enabled = trimmed.length > 0;

  const { data, isLoading, isFetching, error, refetch } =
    useQuery<BdrcOtVolumeDetail>({
      queryKey: [...bdrcOtVolumeQueryKeyRoot, trimmed],
      queryFn: ({ signal }) => fetchBdrcOtVolume(trimmed, { signal }),
      enabled,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    });

  let errorMessage: string | null = null;
  if (error instanceof Error) errorMessage = error.message;
  else if (error) errorMessage = 'Unknown error';

  return {
    volume: data ?? null,
    isLoading,
    isFetching,
    error: errorMessage,
    refetch,
  };
}

