import { useState, useMemo } from 'react';
import { OverviewTab } from '../components/admin';
import { SkeletonLarger } from '@/components/ui/skeleton';
import { useDashboardStats, useOutlinerUsers } from '../hooks';
import { UserFilter } from '@/components/admin/documents/UserFilter';
import { useSearchParams } from 'react-router-dom';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function OutlinerAdminDashboard() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [searchParams,setSearchParams] = useSearchParams();
  const startDate = searchParams.get('startDate') || defaultRange.start;
  const endDate = searchParams.get('endDate') || defaultRange.end;

  function setStartDate(date: string) {
    setSearchParams(params => {
      params.set('startDate', date);
      return params;
    });
  }
  function setEndDate(date: string) {
    setSearchParams(params => {
    params.set('endDate', date);
    return params;
  });
}

  const selectedUserId = searchParams.get('annotator') || undefined;


  const { users: outlinerUsers, isLoading: usersLoading } = useOutlinerUsers();

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
       
        <label className="sr-only" htmlFor="start-date">From</label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 px-2.5 py-1.5 text-sm bg-white"
        />
        <span className="text-gray-400 text-sm">–</span>
        <label className="sr-only" htmlFor="end-date">To</label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 px-2.5 py-1.5 text-sm bg-white"
        />
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
