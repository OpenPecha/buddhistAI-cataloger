import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import StatsCard from '../shared/StatsCard'
import type { DashboardStats } from '@/api/outliner'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface OverviewTabProps {
  readonly stats: DashboardStats | null
  readonly isLoading?: boolean
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
      ticks: { font: { size: 11 }, color: '#6b7280' },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 11 }, color: '#6b7280' },
    },
  },
} as const

function OverviewTab({ stats, isLoading }: OverviewTabProps) {
  const chartData = useMemo(() => {
    if (!stats) return null
    return {
      labels: ['Documents', 'Total segments', 'With title/author', 'Rejections'],
      datasets: [
        {
          data: [
            stats.document_count,
            stats.total_segments,
            stats.segments_with_title_or_author,
            stats.rejection_count,
          ],
          backgroundColor: ['#2563eb', '#059669', '#7c3aed', '#dc2626'],
          borderColor: ['#1d4ed8', '#047857', '#6d28d9', '#b91c1c'],
          borderWidth: 1,
        },
      ],
    }
  }, [stats])

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-gray-600" />
        <span className="ml-2 text-sm text-gray-500">Loading stats…</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <p className="text-gray-500 text-center py-12 text-sm">No data available.</p>
    )
  }

  return (
    <div className="space-y-4">
      

      {chartData && (
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Overview</p>
          <div className="h-64">
            <Bar data={chartData} options={CHART_OPTIONS} />
          </div>
        </div>
      )}
    </div>
  )
}

export default OverviewTab;
