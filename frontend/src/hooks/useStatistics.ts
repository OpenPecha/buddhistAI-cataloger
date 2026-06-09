import { useQuery } from '@tanstack/react-query';
import { getStatistics, type StatisticsData } from '@/api/outliner';
import type { DashboardStatsFilters } from './useDashboardStats';

export function useStatistics(filters: DashboardStatsFilters = {}) {
  const { userId, startDate, endDate } = filters;

  const { data, isLoading, error, refetch } = useQuery<StatisticsData>({
    queryKey: ['statistics', { userId, startDate, endDate }],
    queryFn: () => getStatistics(userId, startDate, endDate),
    staleTime: 2 * 60 * 1000,
  });

  return { data, isLoading, error, refetch };
}
