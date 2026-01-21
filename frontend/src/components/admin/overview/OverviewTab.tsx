import StatsCard from '../shared/StatsCard';
import type { DocumentStats } from '../shared/types';

interface OverviewTabProps {
  stats: DocumentStats;
}

function OverviewTab({ stats }: OverviewTabProps) {
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

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Document Status Distribution</h3>
        <div className="space-y-3">
          <StatusBar
            label="Active"
            value={stats.active}
            total={stats.total}
            colorClass="bg-blue-500"
          />
          <StatusBar
            label="Completed"
            value={stats.completed}
            total={stats.total}
            colorClass="bg-green-500"
          />
          <StatusBar
            label="Approved"
            value={stats.approved}
            total={stats.total}
            colorClass="bg-purple-500"
          />
          <StatusBar
            label="Rejected"
            value={stats.rejected}
            total={stats.total}
            colorClass="bg-red-500"
          />
        </div>
      </div>
    </div>
  );
}

interface StatusBarProps {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}

function StatusBar({ label, value, total, colorClass }: StatusBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      <div className="flex items-center">
        <div className="w-32 bg-gray-200 rounded-full h-3 mr-3">
          <div
            className={`${colorClass} h-3 rounded-full`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

export default OverviewTab;