import { useQuery } from '@tanstack/react-query';
import { getReviewerStats, type ReviewerStatsData } from '@/api/outliner';
import type { DashboardStatsFilters } from './useDashboardStats';

export function useReviewerStats(filters: DashboardStatsFilters = {}) {
  const { userId, startDate, endDate } = filters;

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ReviewerStatsData>({
    queryKey: ['reviewer-stats', { userId, startDate, endDate }],
    queryFn: () => getReviewerStats(userId, startDate, endDate),
    staleTime: 2 * 60 * 1000,
  });

  return { data, isLoading, error, refetch };
}
