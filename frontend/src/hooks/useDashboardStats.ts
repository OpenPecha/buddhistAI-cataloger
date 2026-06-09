import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, type DashboardStats } from '@/api/outliner';

export interface DashboardStatsFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  dateBasis?: 'created' | 'reviewed';
}

export function useDashboardStats(filters: DashboardStatsFilters = {}) {
  const { userId, startDate, endDate, dateBasis = 'reviewed' } = filters;

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', { userId, startDate, endDate, dateBasis }],
    queryFn: () => getDashboardStats(userId, startDate, endDate, dateBasis),
    staleTime: 2 * 60 * 1000,
  });

  return { stats, isLoading, error, refetch };
}
