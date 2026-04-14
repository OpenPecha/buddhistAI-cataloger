import { useMemo } from 'react'
import {
  Ban,
  FileText,
  GitBranch,
  Layers,
  Link2,
  MessageSquare,
  PenLine,
  SkipForward,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import StatsCard from '../shared/StatsCard'
import type { DashboardStats } from '@/api/outliner'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
)

interface OverviewTabProps {
  readonly stats: DashboardStats | null
  readonly isLoading?: boolean
  readonly annotators?: ReadonlyArray<{ id: string; name: string | null }>
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#64748b' },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 11 }, color: '#64748b' },
    },
  },
} as const

const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        padding: 12,
        font: { size: 11 },
        color: '#475569',
      },
    },
  },
} as const

const HBAR_OPTIONS = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 11 }, color: '#64748b' },
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#475569' },
    },
  },
} as const

const ANNOTATOR_LINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 16,
        font: { size: 11 },
        color: '#475569',
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
    title: { display: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 11 },
        color: '#334155',
        maxRotation: 45,
        minRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 11 }, color: '#64748b' },
    },
  },
} as const

const DOC_STATUS_ORDER = [
  'active',
  'completed',
  'approved',
  'rejected',
  'skipped',
  'deleted',
  'unknown',
] as const
const SEG_STATUS_ORDER = ['unchecked', 'checked', 'approved', 'rejected'] as const

const DOC_STATUS_COLORS: Record<string, string> = {
  active: '#2563eb',
  completed: '#059669',
  approved: '#7c3aed',
  rejected: '#dc2626',
  skipped: '#ea580c',
  deleted: '#64748b',
  unknown: '#94a3b8',
}

const SEG_STATUS_COLORS: Record<string, string> = {
  unchecked: '#94a3b8',
  checked: '#d97706',
  approved: '#059669',
  rejected: '#dc2626',
}

const CHART_PALETTE = [
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#d97706',
  '#0ea5e9',
  '#db2777',
  '#4f46e5',
  '#65a30d',
]

function sortKeys(keys: string[], preferred: readonly string[]): string[] {
  const pref = preferred.filter((k) => keys.includes(k))
  const rest = keys.filter((k) => !preferred.includes(k)).sort()
  return [...pref, ...rest]
}

function colorsForKeys(keys: string[], map: Record<string, string>, fallback: string[]): string[] {
  return keys.map((k, i) => map[k] ?? fallback[i % fallback.length])
}

function formatChartLabel(key: string): string {
  if (key === 'TOC') return 'TOC'
  if (key === 'unset' || key === 'unknown') return key === 'unset' ? 'Unset' : 'Unknown'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function OverviewTab({ stats, isLoading, annotators = [] }: OverviewTabProps) {
  const overviewBarData = useMemo(() => {
    if (!stats) return null
    const skippedDocs = stats.document_status_counts.skipped ?? 0
    return {
      labels: [
        'Documents',
        'Total segments',
        'With title/author',
        'Skipped docs',
        'Unresolved rejected',
      ],
      datasets: [
        {
          data: [
            stats.document_count,
            stats.total_segments,
            stats.segments_with_title_or_author,
            skippedDocs,
            stats.rejection_count,
          ],
          backgroundColor: ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#dc2626'],
          borderColor: ['#1d4ed8', '#047857', '#6d28d9', '#c2410c', '#b91c1c'],
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    }
  }, [stats])

  const documentStatusChart = useMemo(() => {
    if (!stats) return null
    const entries = Object.entries(stats.document_status_counts).filter(([, v]) => v > 0)
    if (entries.length === 0) return null
    const keys = sortKeys(entries.map(([k]) => k), [...DOC_STATUS_ORDER])
    const data = keys.map((k) => stats.document_status_counts[k] ?? 0)
    return {
      labels: keys.map(formatChartLabel),
      datasets: [
        {
          data,
          backgroundColor: colorsForKeys(keys, DOC_STATUS_COLORS, CHART_PALETTE),
          borderWidth: 0,
        },
      ],
    }
  }, [stats])

  const segmentStatusChart = useMemo(() => {
    if (!stats) return null
    const entries = Object.entries(stats.segment_status_counts).filter(([, v]) => v > 0)
    if (entries.length === 0) return null
    const keys = sortKeys(entries.map(([k]) => k), [...SEG_STATUS_ORDER])
    const data = keys.map((k) => stats.segment_status_counts[k] ?? 0)
    return {
      labels: keys.map(formatChartLabel),
      datasets: [
        {
          data,
          backgroundColor: colorsForKeys(keys, SEG_STATUS_COLORS, CHART_PALETTE),
          borderWidth: 0,
        },
      ],
    }
  }, [stats])

  const labelBarData = useMemo(() => {
    if (!stats) return null
    const entries = Object.entries(stats.segment_label_counts).filter(([, v]) => v > 0)
    if (entries.length === 0) return null
    entries.sort((a, b) => b[1] - a[1])
    const labels = entries.map(([k]) => formatChartLabel(k))
    const data = entries.map(([, v]) => v)
    return {
      labels,
      datasets: [
        {
          label: 'Segments',
          data,
          backgroundColor: CHART_PALETTE[0],
          borderRadius: 6,
        },
      ],
    }
  }, [stats])

  const annotatorCompareData = useMemo(() => {
    if (!stats) return null
    const perf = stats.annotator_performance ?? []
    if (perf.length === 0) return null

    const nameFor = (userId: string | null) => {
      if (userId == null || userId === '') return 'Unassigned'
      const u = annotators.find((a) => a.id === userId)
      const n = u?.name?.trim()
      return n || userId
    }

    return {
      labels: perf.map((r) => nameFor(r.user_id)),
      datasets: [
        {
          label: 'Segments',
          data: perf.map((r) => r.segment_count),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
        },
        {
          label: 'Title / author',
          data: perf.map((r) => r.segments_with_title_or_author),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#7c3aed',
        },
        {
          label: 'Unresolved rejected',
          data: perf.map((r) => r.rejection_count),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#dc2626',
        },
      ],
    }
  }, [stats, annotators])

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 shadow-sm">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
          aria-hidden
        />
        <span className="ml-3 text-sm text-slate-600">Loading stats…</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-14 text-center text-sm text-slate-500">
        No data available.
      </p>
    )
  }

  const coverage = stats.annotation_coverage_pct
  const skippedDocuments = stats.document_status_counts.skipped ?? 0

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Key metrics
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatsCard
            icon={<FileText className="h-6 w-6 text-blue-500" strokeWidth={1.75} />}
            title="Documents"
            value={stats.document_count}
            colorClass="text-blue-600"
            hint="In current filters"
          />
          <StatsCard
            icon={<Layers className="h-6 w-6 text-emerald-500" strokeWidth={1.75} />}
            title="Total segments"
            value={stats.total_segments}
            colorClass="text-emerald-600"
          />
          <StatsCard
            icon={<PenLine className="h-6 w-6 text-violet-500" strokeWidth={1.75} />}
            title="With title or author"
            value={stats.segments_with_title_or_author}
            colorClass="text-violet-600"
            hint={
              stats.total_segments
                ? `${coverage}% of segments`
                : undefined
            }
            footer={
              <div className="space-y-1.5 border-t border-violet-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Reviewed (done or approved)</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {stats.segments_with_title_or_author_reviewed.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Not yet reviewed</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {stats.segments_with_title_or_author_pending_review.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-1.5">
                  <span className="text-slate-500">Title set, not reviewed</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {stats.segments_with_title_not_reviewed.toLocaleString()}
                  </span>
                </div>
              </div>
            }
          />
          <StatsCard
            icon={<SkipForward className="h-6 w-6 text-orange-500" strokeWidth={1.75} />}
            title="Skipped documents"
            value={skippedDocuments}
            colorClass="text-orange-600"
            hint={
              stats.document_count && skippedDocuments > 0
                ? `${Math.round((skippedDocuments / stats.document_count) * 100)}% of documents`
                : undefined
            }
          />
          <StatsCard
            icon={<Ban className="h-6 w-6 text-red-500" strokeWidth={1.75} />}
            title="Rejected segments"
            value={stats.rejection_count}
            colorClass="text-red-600"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Annotation & linkage
        </h3>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Annotation coverage
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{coverage}%</p>
            <p className="mt-1 text-sm text-slate-500">
              Segments with a title or author out of {stats.total_segments.toLocaleString()} total.
              Of those, {stats.segments_with_title_or_author_reviewed.toLocaleString()} are reviewed
              (segment done or approved) and{' '}
              {stats.segments_with_title_or_author_pending_review.toLocaleString()} are not yet reviewed.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Segments with a title filled in but not yet reviewed:{' '}
              {stats.segments_with_title_not_reviewed.toLocaleString()}.
            </p>
            <div
              className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-violet-100"
              role="progressbar"
              aria-valuenow={coverage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
            <StatsCard
              icon={<Link2 className="h-6 w-6 text-sky-500" strokeWidth={1.75} />}
              title="BDRC-linked"
              value={stats.segments_with_bdrc_id}
              colorClass="text-sky-600"
              hint="Title or author BDRC ID"
            />
            <StatsCard
              icon={<MessageSquare className="h-6 w-6 text-amber-500" strokeWidth={1.75} />}
              title="With comments"
              value={stats.segments_with_comments}
              colorClass="text-amber-600"
              hint="Rejected segments that have comments"
            />
            <StatsCard
              icon={<GitBranch className="h-6 w-6 text-indigo-500" strokeWidth={1.75} />}
              title="Child segments"
              value={stats.segments_with_parent}
              colorClass="text-indigo-600"
              hint="Has parent segment"
            />
          </div>
        </div>
      </section>

      {overviewBarData && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Volume overview</p>
          <p className="mt-1 text-sm text-slate-600">
            Same core counts as key metrics, shown as a bar chart for quick comparison.
          </p>
          <div className="mt-4 h-64">
            <Bar data={overviewBarData} options={CHART_OPTIONS} />
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Documents by status
          </p>
          <p className="mt-1 text-sm text-slate-600">Workflow state from outliner documents.</p>
          <div className="mt-4 flex h-72 items-center justify-center">
            {documentStatusChart ? (
              <Doughnut data={documentStatusChart} options={DOUGHNUT_OPTIONS} />
            ) : (
              <p className="text-sm text-slate-400">No documents in range.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Segment labels
          </p>
          <p className="mt-1 text-sm text-slate-600">Front matter, TOC, text, back matter, etc.</p>
          <div className="mt-4 h-64">
            {labelBarData ? (
              <Bar data={labelBarData} options={HBAR_OPTIONS} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No label data.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
       
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Annotator performance
          </p>
       
          <div className="mt-4 h-80 min-h-64">
            {annotatorCompareData ? (
              <Line data={annotatorCompareData} options={ANNOTATOR_LINE_OPTIONS} />
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center text-sm text-slate-400">
                No annotator activity in this date range.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default OverviewTab
