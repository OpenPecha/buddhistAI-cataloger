import { useQuery } from '@tanstack/react-query';
import { fetchPreparedAlignmentData, type PreparedDataResponse } from '../../../api/annotation';

/**
 * Hook for fetching prepared alignment data for source and target instances
 * 
 * @param sourceInstanceId - The ID of the source instance
 * @param targetInstanceId - The ID of the target instance
 * @returns React Query result with prepared alignment data
 */
export const usePreparedAlignmentData = (
  sourceInstanceId: string | null,
  targetInstanceId: string | null
) => {
  return useQuery<PreparedDataResponse>({
    queryKey: ['preparedAlignmentData', sourceInstanceId, targetInstanceId],
    queryFn: () => {
      if (!sourceInstanceId || !targetInstanceId) {
        throw new Error('Source and target instance IDs are required');
      }
      return fetchPreparedAlignmentData(sourceInstanceId, targetInstanceId);
    },
    enabled: Boolean(sourceInstanceId) && Boolean(targetInstanceId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });
};


