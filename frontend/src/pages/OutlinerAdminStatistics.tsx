import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SkeletonLarger } from '@/components/ui/skeleton';
import { useStatistics } from '@/hooks/useStatistics';
import type { DashboardStatsFilters } from '@/hooks';
import { UserFilter } from '@/components/admin/documents/UserFilter';
import DateRangeFilter from '@/components/admin/documents/DateRangeFilter';
import { Button } from '@/components/ui/button';
import { getDefaultDateRange } from '@/components/admin/documents/utils';
import type { AnnotatorApprovedRow, ReviewerApprovedRow } from '@/api/outliner';

type AnnotatorSortField = 'segments_approved';
type ReviewerSortField = 'segments_reviewed';
type SortDir = 'asc' | 'desc';

const cardPanel =
  'rounded-2xl border border-border/70 bg-card/95 p-6 shadow-elegant backdrop-blur-[2px]';

function SortIcon<F extends string>({
  field,
  active,
  dir,
}: Readonly<{ field: F; active: F; dir: SortDir }>) {
  if (field !== active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  return dir === 'desc'
    ? <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
    : <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
}

function OutlinerAdminStatistics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const startDate = searchParams.get('startDate') || defaultRange.start;
  const endDate = searchParams.get('endDate') || defaultRange.end;
  const dataParse = (date: string) => new Date(date).toISOString().split('T')[0];

  const selectedUserId = searchParams.get('annotator') || undefined;

  const initialFilters: DashboardStatsFilters = {
    userId: selectedUserId,
    startDate: startDate ? dataParse(startDate) : undefined,
    endDate: endDate ? dataParse(endDate) : undefined,
  };

  const { data, isLoading } = useStatistics({
    userId: selectedUserId,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
  });

  const [filters, setFilters] = useState<DashboardStatsFilters>(initialFilters);

  const [annotatorSortDir, setAnnotatorSortDir] = useState<SortDir>('desc');
  const [reviewerSortDir, setReviewerSortDir] = useState<SortDir>('desc');

  const startDateParsed = filters.startDate ? dataParse(filters.startDate) : '';
  const endDateParsed = filters.endDate ? dataParse(filters.endDate) : '';

  const applyFilters = () => {
    setSearchParams((params) => {
      params.set('startDate', startDateParsed);
      params.set('endDate', endDateParsed);
      if (filters.userId && filters.userId !== 'all') {
        params.set('annotator', filters.userId);
      } else {
        params.delete('annotator');
      }
      return params;
    });
  };

  const checkApplyButtonDisabled = () =>
    startDateParsed === initialFilters.startDate &&
    endDateParsed === initialFilters.endDate &&
    (filters.userId || 'all') === (initialFilters.userId || 'all');

  const annotatorRows: AnnotatorApprovedRow[] = data?.annotators ?? [];
  const reviewerRows: ReviewerApprovedRow[] = data?.reviewers ?? [];

  const sortedAnnotators = useMemo(
    () =>
      [...annotatorRows].sort(
        (a, b) =>
          (annotatorSortDir === 'desc' ? -1 : 1) * (a.segments_approved - b.segments_approved),
      ),
    [annotatorRows, annotatorSortDir],
  );

  const sortedReviewers = useMemo(
    () =>
      [...reviewerRows].sort(
        (a, b) =>
          (reviewerSortDir === 'desc' ? -1 : 1) * (a.segments_reviewed - b.segments_reviewed),
      ),
    [reviewerRows, reviewerSortDir],
  );

  const annotatorTotal = sortedAnnotators.reduce((s, r) => s + r.segments_approved, 0);
  const reviewerTotal = sortedReviewers.reduce((s, r) => s + r.segments_reviewed, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {/* Filters bar */}
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
        <div className="flex flex-col gap-6">
          {/* Annotator table */}
          <section className={cardPanel}>
            <div className="mb-4 min-w-0 border-l-[3px] border-primary pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Per Annotator
              </p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Annotator Approved Segments
              </h3>
            </div>

            {sortedAnnotators.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 py-12 text-center text-sm text-muted-foreground">
                No data for this period.
              </p>
            ) : (
              <div className="max-h-[min(640px,60vh)] overflow-y-auto overflow-x-auto rounded-lg border border-stone-200/80 bg-white/60">
                <table className="w-full min-w-[24rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(231_229_228)]">
                    <tr className="border-b border-stone-200 bg-stone-50/95 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      <th className="px-4 py-3">No.</th>
                      <th className="px-4 py-3">Annotator</th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
                          onClick={() =>
                            setAnnotatorSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                          }
                        >
                          Approved
                          <SortIcon<AnnotatorSortField>
                            field="segments_approved"
                            active="segments_approved"
                            dir={annotatorSortDir}
                          />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAnnotators.map((row, idx) => (
                      <tr
                        key={row.user_id ?? row.name}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                      >
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{idx + 1}</td>
                        <td className="max-w-[14rem] px-4 py-3 font-medium leading-snug text-foreground sm:max-w-none sm:whitespace-normal">
                          <span className="break-words">{row.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {row.segments_approved.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-stone-50/95 shadow-[0_-1px_0_0_rgb(231_229_228)]">
                    <tr className="border-t border-stone-200 text-xs font-semibold text-muted-foreground">
                      <td className="px-4 py-3" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                        {annotatorTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Reviewer table */}
          <section className={cardPanel}>
            <div className="mb-4 min-w-0 border-l-[3px] border-primary pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Per Reviewer
              </p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Reviewer Approved Segments
              </h3>
            </div>

            {sortedReviewers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 py-12 text-center text-sm text-muted-foreground">
                No data for this period.
              </p>
            ) : (
              <div className="max-h-[min(640px,60vh)] overflow-y-auto overflow-x-auto rounded-lg border border-stone-200/80 bg-white/60">
                <table className="w-full min-w-[24rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(231_229_228)]">
                    <tr className="border-b border-stone-200 bg-stone-50/95 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      <th className="px-4 py-3">No.</th>
                      <th className="px-4 py-3">Reviewer</th>
                      <th className="px-4 py-3 text-right tabular-nums">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
                          onClick={() =>
                            setReviewerSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                          }
                        >
                          Segments Reviewed
                          <SortIcon<ReviewerSortField>
                            field="segments_reviewed"
                            active="segments_reviewed"
                            dir={reviewerSortDir}
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right tabular-nums">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviewers.map((row, idx) => (
                      <tr
                        key={row.user_id ?? row.name}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                      >
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{idx + 1}</td>
                        <td className="max-w-[14rem] px-4 py-3 font-medium leading-snug text-foreground sm:max-w-none sm:whitespace-normal">
                          <span className="break-words">{row.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                          {row.segments_reviewed.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600">
                          {row.rejection_count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-stone-50/95 shadow-[0_-1px_0_0_rgb(231_229_228)]">
                    <tr className="border-t border-stone-200 text-xs font-semibold text-muted-foreground">
                      <td className="px-4 py-3" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700">
                        {reviewerTotal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600">
                        {sortedReviewers.reduce((s, r) => s + r.rejection_count, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default OutlinerAdminStatistics;
