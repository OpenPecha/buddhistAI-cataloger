import { useMemo, useState } from 'react';
import { OverviewTab } from '../components/admin';
import { SkeletonLarger } from '@/components/ui/skeleton';
import { useDashboardStats, type DashboardStatsFilters } from '../hooks';
import { UserFilter } from '@/components/admin/documents/UserFilter';
import { useSearchParams } from 'react-router-dom';
import { getDefaultDateRange } from '@/components/admin/documents/utils';
import DateRangeFilter from '@/components/admin/documents/DateRangeFilter';
import { Button } from '@/components/ui/button';





function OutlinerAdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserId = searchParams.get('annotator') || undefined;
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const startDate = searchParams.get('startDate') || defaultRange.start;
  const endDate = searchParams.get('endDate') || defaultRange.end;
  const dataBasisParam = (searchParams.get('dateBasis') as 'created' | 'reviewed') || 'reviewed';
  const dataParse=(date:string)=>new Date(date).toISOString().split('T')[0]

  const initialFilters: DashboardStatsFilters = {
    userId: selectedUserId || undefined,
    startDate: startDate ? dataParse(startDate) : undefined,
    endDate: endDate ? dataParse(endDate) : undefined,
    dateBasis: dataBasisParam,
  };
  const { stats, isLoading } = useDashboardStats({
    userId: searchParams.get('annotator') || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
    dateBasis: dataBasisParam,
  });

  const [filters, setFilters] = useState<DashboardStatsFilters>(initialFilters)

  const startDateParsed = dataParse(filters.startDate||"")
  const endDateParsed = dataParse(filters.endDate||"")
  const applyFilters = () => {
    setSearchParams(params => {
      params.set('annotator', filters.userId || '');
      if (filters.userId === 'all') params.delete('annotator');
      params.set('startDate', startDateParsed);
      params.set('endDate', endDateParsed);
      params.set('dateBasis', filters.dateBasis || 'reviewed');
      params.set('page', '1');
      return params;
    });
  }
  const checkApplyButtonDisabled = () => {
    if (
      filters.userId !== initialFilters.userId ||
      startDateParsed !== initialFilters.startDate ||
      endDateParsed !== initialFilters.endDate ||
      filters.dateBasis !== initialFilters.dateBasis
    ) {
      return false;
    }
    return true;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 bg-gray-50/80">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filters</span>
        <UserFilter value={filters.userId || 'all'} onChange={(userId) => setFilters({...filters, userId})}/>
        <div className="flex rounded-md border border-gray-300 bg-white overflow-hidden text-sm shrink-0">
          {(['reviewed', 'created'] as const).map((basis) => (
            <button
              key={basis}
              type="button"
              onClick={() => setFilters({ ...filters, dateBasis: basis })}
              className={`px-3 py-1.5 transition-colors ${
                (filters.dateBasis || 'reviewed') === basis
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {basis === 'reviewed' ? 'Reviewed date' : 'Created date'}
            </button>
          ))}
        </div>
        <DateRangeFilter onUpdateStartDate={(startDate) => setFilters({...filters, startDate})} onUpdateEndDate={(endDate) => setFilters({...filters, endDate})}/>
        <Button disabled={checkApplyButtonDisabled()} onClick={applyFilters} className="shrink-0">Apply Filters</Button>
      </div>

        {isLoading &&
        <SkeletonLarger />
        }
      <OverviewTab
        stats={stats ?? null}
        isLoading={isLoading}
        dashboardDateRange={{ start: startDate, end: endDate }}
      />
    </div>
  );
}

export default OutlinerAdminDashboard;
