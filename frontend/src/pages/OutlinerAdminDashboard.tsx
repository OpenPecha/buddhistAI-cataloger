import { OverviewTab } from '../components/admin';
import { useDocuments } from '../hooks';

function OutlinerAdminDashboard() {
  const { stats, isLoading } = useDocuments();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, documents, and system settings</p>
        </div>

        <OverviewTab stats={stats} />
      </div>
    </div>
  );
}

export default OutlinerAdminDashboard;
