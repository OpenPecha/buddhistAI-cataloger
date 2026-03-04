import StatsCard from '../shared/StatsCard';
import type { DashboardStats } from '@/api/outliner';

interface OverviewTabProps {
  readonly stats: DashboardStats | null;
  readonly isLoading?: boolean;
}

function OverviewTab({ stats, isLoading }: OverviewTabProps) {
  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-2 text-gray-600">Loading stats...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-gray-500 text-center py-12">No data available.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsCard
        icon="📄"
        title="Documents"
        value={stats.document_count}
        colorClass="text-blue-600"
      />
      <StatsCard
        icon="🧩"
        title="Total Segments"
        value={stats.total_segments}
        colorClass="text-green-600"
      />
      <StatsCard
        icon="✏️"
        title="With Title / Author"
        value={stats.segments_with_title_or_author}
        colorClass="text-purple-600"
      />
      <StatsCard
        icon="🚫"
        title="Rejections"
        value={stats.rejection_count}
        colorClass="text-red-600"
      />
    </div>
  );
}

export default OverviewTab;
