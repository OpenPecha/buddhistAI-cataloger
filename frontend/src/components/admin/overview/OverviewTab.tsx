import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type TooltipItem,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import StatsCard from '../shared/StatsCard'
import type { DocumentStats } from '../shared/types'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const STATUS_COLORS = {
  active: {
    background: 'rgba(59, 130, 246, 0.8)',
    border: 'rgba(59, 130, 246, 1)',
  },
  completed: {
    background: 'rgba(34, 197, 94, 0.8)',
    border: 'rgba(34, 197, 94, 1)',
  },
  approved: {
    background: 'rgba(168, 85, 247, 0.8)',
    border: 'rgba(168, 85, 247, 1)',
  },
  rejected: {
    background: 'rgba(239, 68, 68, 0.8)',
    border: 'rgba(239, 68, 68, 1)',
  },
  total: {
    background: 'rgba(59, 130, 246, 0.8)',
    border: 'rgba(59, 130, 246, 1)',
  },
  approvedBar: {
    background: 'rgba(251, 146, 60, 0.8)',
    border: 'rgba(251, 146, 60, 1)',
  },
} as const

interface OverviewTabProps {
  readonly stats: DocumentStats
}

function createStatusChartData(stats: DocumentStats) {
  return {
    labels: ['Active', 'Completed', 'Approved', 'Rejected'],
    datasets: [
      {
        label: 'Documents',
        data: [stats.active, stats.completed, stats.approved, stats.rejected],
        backgroundColor: [
          STATUS_COLORS.active.background,
          STATUS_COLORS.completed.background,
          STATUS_COLORS.approved.background,
          STATUS_COLORS.rejected.background,
        ],
        borderColor: [
          STATUS_COLORS.active.border,
          STATUS_COLORS.completed.border,
          STATUS_COLORS.approved.border,
          STATUS_COLORS.rejected.border,
        ],
        borderWidth: 2,
      },
    ],
  }
}

function createBarChartData(stats: DocumentStats) {
  return {
    labels: ['Total', 'Active', 'Completed', 'Approved', 'Rejected'],
    datasets: [
      {
        label: 'Document Count',
        data: [
          stats.total,
          stats.active,
          stats.completed,
          stats.approved,
          stats.rejected,
        ],
        backgroundColor: [
          STATUS_COLORS.total.background,
          STATUS_COLORS.active.background,
          STATUS_COLORS.completed.background,
          STATUS_COLORS.approvedBar.background,
          STATUS_COLORS.rejected.background,
        ],
        borderColor: [
          STATUS_COLORS.total.border,
          STATUS_COLORS.active.border,
          STATUS_COLORS.completed.border,
          STATUS_COLORS.approvedBar.border,
          STATUS_COLORS.rejected.border,
        ],
        borderWidth: 1,
      },
    ],
  }
}

function OverviewTab({ stats }: OverviewTabProps) {
  const statusChartData = createStatusChartData(stats)
  const barChartData = createBarChartData(stats)

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'> | TooltipItem<'bar'>) => {
            const value =
              typeof context.parsed === 'number'
                ? context.parsed
                : context.parsed.y ?? 0
            return `${context.label}: ${value} documents`
          },
        },
      },
    },
  }

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          icon="📄"
          title="Total Documents"
          value={stats.total}
          colorClass="text-blue-600"
        />
        <StatsCard
          icon="🔄"
          title="Active Documents"
          value={stats.active}
          colorClass="text-green-600"
        />
        <StatsCard
          icon="✅"
          title="Completed"
          value={stats.completed}
          colorClass="text-purple-600"
        />
        <StatsCard
          icon="📊"
          title="Approved"
          value={stats.approved}
          colorClass="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">
            Status Distribution
          </h3>
          <div className="h-64">
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">
            Document Statistics
          </h3>
          <div className="h-64">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverviewTab