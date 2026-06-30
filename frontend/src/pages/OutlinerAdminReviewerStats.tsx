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
import type { ReviewVerifierBreakdownRow, ReviewerStatsBreakdownRow } from '@/api/outliner';

type SortField = 'reviewer' | 'approvals' | 'rejections' | 'rejection_rate';
type ReviewVerifierSortField = 'reviewer' | 'approvals' | 'rejections' | 'total_segments';
type SortDir = 'asc' | 'desc';

// Rejection % = rejections / approvals * 100 (0 when no approvals)
const rejectionRate = (row: { approvals: number; rejections: number }) =>
  row.approvals > 0 ? (row.rejections / row.approvals) * 100 : 0;
const REJECTION_RATE_FORMULA = 'Rejection % = (No. of Rejections / No. of Approvals) × 100';

const cardPanel =
  'rounded-2xl border border-border/70 bg-card/95 p-6 shadow-elegant backdrop-blur-[2px]';

function SortIcon<F extends string>({ field, active, dir }: Readonly<{ field: F; active: F; dir: SortDir }>) {
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

  const [vfSortField, setVfSortField] = useState<ReviewVerifierSortField>('rejections');
  const [vfSortDir, setVfSortDir] = useState<SortDir>('desc');
  const [rvSortField, setRvSortField] = useState<SortField>('rejections');
  const [rvSortDir, setRvSortDir] = useState<SortDir>('desc');

  const startDateParsed = filters.startDate ? dataParse(filters.startDate) : '';
  const endDateParsed = filters.endDate ? dataParse(filters.endDate) : '';

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

  const toggleVfSort = (field: ReviewVerifierSortField) => {
    if (vfSortField === field) setVfSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setVfSortField(field); setVfSortDir('desc'); }
  };

  const toggleRvSort = (field: SortField) => {
    if (rvSortField === field) setRvSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setRvSortField(field); setRvSortDir('desc'); }
  };

  const sortedReviewVerifiers = useMemo(() => {
    const rows = data?.review_verifier_breakdown ?? [];
    const dir = vfSortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) =>
      vfSortField === 'reviewer'
        ? dir * a.reviewer.localeCompare(b.reviewer)
        : dir * (a[vfSortField] - b[vfSortField]),
    );
  }, [data?.review_verifier_breakdown, vfSortField, vfSortDir]);

  const sortedReviewers = useMemo(() => {
    const rows = data?.reviewer_breakdown ?? [];
    const dir = rvSortDir === 'desc' ? -1 : 1;
    const valueOf = (r: ReviewerStatsBreakdownRow) =>
      rvSortField === 'rejection_rate' ? rejectionRate(r) : r[rvSortField as 'approvals' | 'rejections'];
    return [...rows].sort((a: ReviewerStatsBreakdownRow, b: ReviewerStatsBreakdownRow) =>
      rvSortField === 'reviewer'
        ? dir * a.reviewer.localeCompare(b.reviewer)
        : dir * (valueOf(a) - valueOf(b)),
    );
  }, [data?.reviewer_breakdown, rvSortField, rvSortDir]);

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
          {/* Table 1 — Review Verifier Breakdown */}
          <section className={cardPanel}>
            <div className="mb-4 min-w-0 border-l-[3px] border-primary pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Per Review Verifier
              </p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Review Verifier Breakdown
              </h3>
            </div>

            {sortedReviewVerifiers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 py-12 text-center text-sm text-muted-foreground">
                No data for this period.
              </p>
            ) : (
              <div className="max-h-[min(720px,70vh)] overflow-y-auto overflow-x-auto rounded-lg border border-stone-200/80 bg-white/60">
                <table className="w-full min-w-[28rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(231_229_228)]">
                    <tr className="border-b border-stone-200 bg-stone-50/95 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleVfSort('reviewer')}
                        >
                          Review Verifier
                          <SortIcon field="reviewer" active={vfSortField} dir={vfSortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleVfSort('total_segments')}
                        >
                          Total Segments
                          <SortIcon field="total_segments" active={vfSortField} dir={vfSortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleVfSort('approvals')}
                        >
                          No. of Approvals
                          <SortIcon field="approvals" active={vfSortField} dir={vfSortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleVfSort('rejections')}
                        >
                          No. of Rejections
                          <SortIcon field="rejections" active={vfSortField} dir={vfSortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviewVerifiers.map((row: ReviewVerifierBreakdownRow) => (
                      <tr
                        key={row.user_id}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                      >
                        <td className="max-w-[14rem] px-4 py-3 font-medium leading-snug text-foreground sm:max-w-none sm:whitespace-normal">
                          <span className="break-words">{row.reviewer}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                          {row.total_segments.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {row.approvals.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {row.rejections.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleRvSort('reviewer')}
                        >
                          Reviewer
                          <SortIcon field="reviewer" active={rvSortField} dir={rvSortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleRvSort('approvals')}
                        >
                          No. of Approvals
                          <SortIcon field="approvals" active={rvSortField} dir={rvSortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums" title={REJECTION_RATE_FORMULA}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => toggleRvSort('rejection_rate')}
                        >
                          No. of Rejections
                          <SortIcon field="rejection_rate" active={rvSortField} dir={rvSortDir} />
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
                        <td className="max-w-[14rem] px-4 py-3 font-medium leading-snug text-foreground sm:max-w-none sm:whitespace-normal">
                          <span className="break-words">{row.reviewer}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {row.approvals.toLocaleString()}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums text-red-700"
                          title={REJECTION_RATE_FORMULA}
                        >
                          {row.rejections.toLocaleString()}{' '}
                          <span className="text-muted-foreground">
                            ({rejectionRate(row).toFixed(1)}%)
                          </span>
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
