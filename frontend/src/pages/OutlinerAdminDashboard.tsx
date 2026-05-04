import { useMemo } from 'react';
import { OverviewTab } from '../components/admin';
import { SkeletonLarger } from '@/components/ui/skeleton';
import { useDashboardStats, useOutlinerUsers } from '../hooks';
import { UserFilter } from '@/components/admin/documents/UserFilter';
import { useSearchParams } from 'react-router-dom';
import { getDefaultDateRange } from '@/components/admin/documents/utils';
import DateRangeFilter from '@/components/admin/documents/DateRangeFilter';



function OutlinerAdminDashboard() {
  const [searchParams] = useSearchParams();
  const selectedUserId = searchParams.get('annotator') || undefined;
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const startDate = searchParams.get('startDate') || defaultRange.start;
  const endDate = searchParams.get('endDate') || defaultRange.end;

  const { users: outlinerUsers } = useOutlinerUsers();

  const { stats, isLoading } = useDashboardStats({
    userId: searchParams.get('annotator') || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
  });

  if (isLoading && !stats) {
    return (
      <div className="flex min-h-screen flex-1 flex-col">
        <SkeletonLarger />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 bg-gray-50/80">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filters</span>
        <UserFilter  />
        <DateRangeFilter />
       
       
      </div>

      <OverviewTab
        stats={stats ?? null}
        isLoading={isLoading}
        annotators={outlinerUsers}
        dashboardUserFilter={selectedUserId || undefined}
        dashboardDateRange={{ start: startDate, end: endDate }}
      />
    </div>
  );
}

export default OutlinerAdminDashboard;
