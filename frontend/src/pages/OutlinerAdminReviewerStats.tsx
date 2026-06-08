import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SkeletonLarger } from '@/components/ui/skeleton';
import { useReviewerStats } from '@/hooks/useReviewerStats';
import type { DashboardStatsFilters } from '@/hooks';
import { UserFilter } from '@/components/admin/documents/UserFilter';
import DateRangeFilter from '@/components/admin/documents/DateRangeFilter';
import { Button } from '@/components/ui/button';
import { getDefaultDateRange } from '@/components/admin/documents/utils';
import type { ReviewerStatsBreakdownRow } from '@/api/outliner';

type SortField = 'approvals' | 'rejections';
type SortDir = 'asc' | 'desc';

const cardPanel =
  'rounded-2xl border border-border/70 bg-card/95 p-6 shadow-elegant backdrop-blur-[2px]';

function SortIcon({ field, active, dir }: Readonly<{ field: SortField; active: SortField; dir: SortDir }>) {
  if (field !== active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  return dir === 'desc'
    ? <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
    : <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
}

function OutlinerAdminReviewerStats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserId = searchParams.get('annotator') || undefined;
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const startDate = searchParams.get('startDate') || defaultRange.start;
  const endDate = searchParams.get('endDate') || defaultRange.end;
  const dataParse = (date: string) => new Date(date).toISOString().split('T')[0];

  const initialFilters: DashboardStatsFilters = {
    userId: selectedUserId || undefined,
    startDate: startDate ? dataParse(startDate) : undefined,
    endDate: endDate ? dataParse(endDate) : undefined,
  };

  const { data, isLoading } = useReviewerStats({
    userId: searchParams.get('annotator') || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
  });

  const [filters, setFilters] = useState<DashboardStatsFilters>(initialFilters);
  const [sortField, setSortField] = useState<SortField>('rejections');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const startDateParsed = dataParse(filters.startDate || '');
  const endDateParsed = dataParse(filters.endDate || '');

  const applyFilters = () => {
    setSearchParams((params) => {
      params.set('annotator', filters.userId || '');
      if (filters.userId === 'all') params.delete('annotator');
      params.set('startDate', startDateParsed);
      params.set('endDate', endDateParsed);
      params.set('page', '1');
      return params;
    });
  };

  const checkApplyButtonDisabled = () => {
    return (
      filters.userId === initialFilters.userId &&
      startDateParsed === initialFilters.startDate &&
      endDateParsed === initialFilters.endDate
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedReviewers = useMemo(() => {
    const rows = data?.reviewer_breakdown ?? [];
    return [...rows].sort((a: ReviewerStatsBreakdownRow, b: ReviewerStatsBreakdownRow) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return (a[sortField] - b[sortField]) * mul;
    });
  }, [data?.reviewer_breakdown, sortField, sortDir]);

  const summary = data?.segment_summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 bg-gray-50/80">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filters</span>
        <UserFilter
          value={filters.userId || 'all'}
          onChange={(userId) => setFilters({ ...filters, userId })}
        />
        <DateRangeFilter
          onUpdateStartDate={(sd) => setFilters({ ...filters, startDate: sd })}
          onUpdateEndDate={(ed) => setFilters({ ...filters, endDate: ed })}
        />
        <Button disabled={checkApplyButtonDisabled()} onClick={applyFilters}>
          Apply Filters
        </Button>
      </div>

      {isLoading && <SkeletonLarger />}

      {!isLoading && !data && (
        <p className={`${cardPanel} border-dashed py-16 text-center text-sm text-muted-foreground`}>
          No data available.
        </p>
      )}

      {data && (
        <div className="space-y-8">
          {/* Table 1 — Segment Summary */}
          <section className={cardPanel}>
            <div className="mb-4 min-w-0 border-l-[3px] border-primary pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Summary
              </p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Segment Summary
              </h3>
            </div>
            <div className="overflow-x-auto rounded-lg border border-stone-200/80 bg-white/60">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/90 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-left tabular-nums">Total Segments</th>
                    <th className="px-4 py-3 text-left tabular-nums">Approved</th>
                    <th className="px-4 py-3 text-left tabular-nums">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-stone-100 hover:bg-stone-50/80">
                    <td className="px-4 py-3 text-left tabular-nums font-medium text-foreground">
                      {summary!.total_segments.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium text-emerald-700">
                      {summary!.approved.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium text-red-700">
                      {summary!.rejected.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Table 2 — Reviewer Breakdown */}
          <section className={cardPanel}>
            <div className="mb-4 min-w-0 border-l-[3px] border-primary pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Per Reviewer
              </p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Reviewer Breakdown
              </h3>
            </div>

            {sortedReviewers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 py-12 text-center text-sm text-muted-foreground">
                No data for this period.
              </p>
            ) : (
              <div className="max-h-[min(720px,70vh)] overflow-y-auto overflow-x-auto rounded-lg border border-stone-200/80 bg-white/60">
                <table className="w-full min-w-[28rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(231_229_228)]">
                    <tr className="border-b border-stone-200 bg-stone-50/95 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      <th className="px-4 py-3">Reviewer</th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleSort('approvals')}
                        >
                          No. of Approvals
                          <SortIcon field="approvals" active={sortField} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleSort('rejections')}
                        >
                          No. of Rejections
                          <SortIcon field="rejections" active={sortField} dir={sortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviewers.map((row) => (
                      <tr
                        key={row.user_id}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                      >
                        <td className="max-w-[14rem] px-4 py-2.5 font-medium leading-snug text-foreground sm:max-w-none sm:whitespace-normal">
                          <span className="break-words">{row.reviewer}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                          {row.approvals.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                          {row.rejections.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default OutlinerAdminReviewerStats;
