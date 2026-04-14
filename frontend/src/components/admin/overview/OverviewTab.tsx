import { useMemo, type ReactNode } from 'react'
import {
  Ban,
  BadgeCheck,
  FileText,
  Layers,
  Link2,
  MessageSquare,
  PenLine,
  SkipForward,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'
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

/** Aligned with tailwind.css Tibetan-inspired admin tokens (burgundy / gold / teal). */
const INK = '#1c1917'
const MUTED = '#57534e'
const GRID = '#e7e5e4'
const PRIMARY = '#af2630'
const TEAL = '#14a5b2'
const GOLD = '#b45309'
const EMERALD = '#0f766e'
const VIOLET = '#6b21a8'
const RED = '#b91c1c'

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
      ticks: { font: { size: 11 }, color: MUTED },
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID },
      ticks: { font: { size: 11 }, color: MUTED },
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
        color: MUTED,
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
      grid: { color: GRID },
      ticks: { font: { size: 11 }, color: MUTED },
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: INK },
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
        color: MUTED,
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
        color: INK,
        maxRotation: 45,
        minRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID },
      ticks: { font: { size: 11 }, color: MUTED },
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
  active: TEAL,
  completed: EMERALD,
  approved: VIOLET,
  rejected: RED,
  skipped: GOLD,
  deleted: '#78716c',
  unknown: '#a8a29e',
}

const SEG_STATUS_COLORS: Record<string, string> = {
  unchecked: '#a8a29e',
  checked: GOLD,
  approved: EMERALD,
  rejected: RED,
}

const CHART_PALETTE = [PRIMARY, TEAL, VIOLET, GOLD, '#0369a1', '#86198f', '#3f6212', EMERALD]

const motionContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

const motionItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
}

const cardPanel =
  'rounded-2xl border border-border/70 bg-card/95 p-6 shadow-elegant backdrop-blur-[2px]'

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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly description?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 border-l-[3px] border-primary pl-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h3>
      </div>
      {description ? (
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-right">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function MetricShell({
  accentClass,
  children,
}: {
  readonly accentClass: string
  readonly children: ReactNode
}) {
  return (
    <motion.div variants={motionItem} className="group relative h-full">
      <div
        className={`pointer-events-none absolute left-0 top-5 z-10 h-[calc(100%-2.5rem)] w-1 rounded-full bg-gradient-to-b ${accentClass} opacity-[0.92]`}
        aria-hidden
      />
      <div className="shadow-elegant h-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 pl-2.5 transition-smooth group-hover:border-primary/20 group-hover:shadow-lg">
        {children}
      </div>
    </motion.div>
  )
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
          backgroundColor: [TEAL, EMERALD, VIOLET, GOLD, RED],
          borderColor: [TEAL, EMERALD, VIOLET, GOLD, RED].map((c) => c),
          borderWidth: 1,
          borderRadius: 8,
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
          backgroundColor: PRIMARY,
          borderRadius: 8,
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
          borderColor: TEAL,
          backgroundColor: 'rgba(20, 165, 178, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: TEAL,
        },
        {
          label: 'Title / author',
          data: perf.map((r) => r.segments_with_title_or_author),
          borderColor: VIOLET,
          backgroundColor: 'rgba(107, 33, 168, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: VIOLET,
        },
        {
          label: 'Unresolved rejected',
          data: perf.map((r) => r.rejection_count),
          borderColor: RED,
          backgroundColor: 'rgba(185, 28, 28, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: RED,
        },
        {
          label: 'Reviewed (as reviewer)',
          data: perf.map((r) => r.segments_reviewed ?? 0),
          borderColor: EMERALD,
          backgroundColor: 'rgba(15, 118, 110, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: EMERALD,
        },
        {
          label: 'Self-review (same user)',
          data: perf.map((r) => r.segments_self_reviewed ?? 0),
          borderColor: '#86198f',
          backgroundColor: 'rgba(134, 25, 143, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#86198f',
        },
        {
          label: 'Rejections logged',
          data: perf.map((r) => r.reviewer_rejection_count ?? 0),
          borderColor: GOLD,
          backgroundColor: 'rgba(180, 83, 9, 0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: GOLD,
        },
      ],
    }
  }, [stats, annotators])

  if (isLoading && !stats) {
    return (
      <div
        className={`flex items-center justify-center ${cardPanel} py-20`}
        role="status"
        aria-live="polite"
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-hidden
        />
        <span className="ml-3 text-sm font-medium text-muted-foreground">Loading stats…</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <p
        className={`${cardPanel} border-dashed py-16 text-center text-sm text-muted-foreground`}
        role="status"
      >
        No data available.
      </p>
    )
  }

  const coverage = stats.annotation_coverage_pct
  const skippedDocuments = stats.document_status_counts.skipped ?? 0

  const statsCardInner = 'border-0 bg-transparent shadow-none hover:shadow-none'

  return (
    <div className="relative space-y-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] opacity-[0.45]"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 10% -10%, hsl(var(--primary) / 0.12), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 0%, hsl(var(--secondary) / 0.14), transparent 50%)`,
        }}
        aria-hidden
      />

    
      <motion.section
        variants={motionContainer}
        initial="hidden"
        animate="show"
        viewport={{ once: true, margin: '-40px' }}
      >
        <SectionHeading
          eyebrow="Volume"
          title="Key metrics"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricShell accentClass="from-teal-600 to-teal-400">
            <StatsCard
              className={statsCardInner}
              icon={<FileText className="h-6 w-6 text-teal-600" strokeWidth={1.75} />}
              title="Documents"
              value={stats.document_count}
              colorClass="text-teal-700"
              hint="In current filters"
            />
          </MetricShell>
          <MetricShell accentClass="from-emerald-700 to-emerald-500">
            <StatsCard
              className={statsCardInner}
              icon={<Layers className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />}
              title="Total segments"
              value={stats.total_segments}
              colorClass="text-emerald-800"
            />
          </MetricShell>
          <MetricShell accentClass="from-violet-700 to-violet-500">
            <StatsCard
              className={statsCardInner}
              icon={<PenLine className="h-6 w-6 text-violet-600" strokeWidth={1.75} />}
              title="With title or author"
              value={stats.segments_with_title_or_author}
              colorClass="text-violet-800"
              footer={
                <div className="space-y-1.5 border-t border-violet-200/80 pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <span>Reviewed</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.segments_with_title_or_author_reviewed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Annotated (not reviewed)</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.segments_with_title_or_author_pending_review.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Title set (not reviewed)</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.segments_with_title_not_reviewed.toLocaleString()}
                    </span>
                  </div>
                </div>
              }
            />
          </MetricShell>
          <MetricShell accentClass="from-amber-700 to-amber-500">
            <StatsCard
              className={statsCardInner}
              icon={<SkipForward className="h-6 w-6 text-amber-700" strokeWidth={1.75} />}
              title="Skipped documents"
              value={skippedDocuments}
              colorClass="text-amber-800"
              hint={
                stats.document_count && skippedDocuments > 0
                  ? `${Math.round((skippedDocuments / stats.document_count) * 100)}% of documents`
                  : undefined
              }
            />
          </MetricShell>
          <MetricShell accentClass="from-teal-800 to-cyan-500">
            <StatsCard
              className={statsCardInner}
              icon={<BadgeCheck className="h-6 w-6 text-teal-700" strokeWidth={1.75} />}
              title="Reviewed (reviewer recorded)"
              value={stats.segments_checked_approved_with_reviewer}
              colorClass="text-teal-900"
              hint="Done or approved with a reviewer user id stored"
            />
          </MetricShell>
          <MetricShell accentClass="from-fuchsia-700 to-pink-500">
            <StatsCard
              className={statsCardInner}
              icon={<UserRoundCheck className="h-6 w-6 text-fuchsia-700" strokeWidth={1.75} />}
              title="Self-reviewed segments"
              value={stats.segments_self_reviewed_total}
              colorClass="text-fuchsia-900"
              hint="Same user owns the document and is the recorded reviewer"
            />
          </MetricShell>
          <MetricShell accentClass="from-red-700 to-red-500">
            <StatsCard
              className={statsCardInner}
              icon={<Ban className="h-6 w-6 text-red-600" strokeWidth={1.75} />}
              title="Rejected segments"
              value={stats.rejection_count}
              colorClass="text-red-800"
            />
          </MetricShell>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-24px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <SectionHeading
          eyebrow="Quality"
          title="Annotation & linkage"
        />
        <div className="grid gap-5 lg:grid-cols-12">
          <motion.div
            className={`relative overflow-hidden lg:col-span-5 ${cardPanel}`}
            whileHover={{ scale: 1.005 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <div
              className="gradient-gold absolute -right-16 top-0 h-48 w-48 rounded-full opacity-[0.12] blur-2xl"
              aria-hidden
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Annotation coverage
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {coverage}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Share of segments meeting coverage rules.</p>
            <div
              className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={coverage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            <MetricShell accentClass="from-sky-700 to-sky-500">
              <StatsCard
                className={statsCardInner}
                icon={<Link2 className="h-6 w-6 text-sky-700" strokeWidth={1.75} />}
                title="BDRC-linked"
                value={stats.segments_with_bdrc_id}
                colorClass="text-sky-900"
                hint="Title or author BDRC ID"
              />
            </MetricShell>
          
          </div>
        </div>
      </motion.section>

      {overviewBarData && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardPanel} relative overflow-hidden`}
        >
          <div
            className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-secondary to-teal-600"
            aria-hidden
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Volume overview</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Same core counts as key metrics, shown as bars for at-a-glance comparison.
          </p>
          <div className="mt-5 h-64">
            <Bar data={overviewBarData} options={CHART_OPTIONS} />
          </div>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className={cardPanel}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Documents by status
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Workflow state from outliner documents.</p>
          <div className="mt-4 flex h-72 items-center justify-center">
            {documentStatusChart ? (
              <Doughnut data={documentStatusChart} options={DOUGHNUT_OPTIONS} />
            ) : (
              <p className="text-sm text-muted-foreground">No documents in range.</p>
            )}
          </div>
        </div>
        <div className={cardPanel}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Segments by status
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Checked, approved, rejected, and unchecked.</p>
          <div className="mt-4 flex h-72 items-center justify-center">
            {segmentStatusChart ? (
              <Doughnut data={segmentStatusChart} options={DOUGHNUT_OPTIONS} />
            ) : (
              <p className="text-sm text-muted-foreground">No segment status data.</p>
            )}
          </div>
        </div>
        <div className={cardPanel}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Segment labels</p>
          <p className="mt-2 text-sm text-muted-foreground">Front matter, TOC, text, back matter, etc.</p>
          <div className="mt-4 h-64">
            {labelBarData ? (
              <Bar data={labelBarData} options={HBAR_OPTIONS} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No label data.
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cardPanel}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Per-user workload</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Title or author counts reflect segments on documents assigned to that user. Reviewed and self-review
          use the reviewer recorded when a segment is marked done or approved (same date filter as documents).
          Rejections logged counts rejection events where that user is the reviewer.
        </p>
        <div className="mt-5 h-80 min-h-64">
          {annotatorCompareData ? (
            <Line data={annotatorCompareData} options={ANNOTATOR_LINE_OPTIONS} />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">
              No annotator activity in this date range.
            </div>
          )}
        </div>
      </motion.section>
    </div>
  )
}

export default OverviewTab
