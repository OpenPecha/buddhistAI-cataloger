import { useState, useMemo } from 'react';
import { OverviewTab } from '../components/admin';
import { useDashboardStats, useOutlinerUsers } from '../hooks';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function OutlinerAdminDashboard() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const { users: outlinerUsers, isLoading: usersLoading } = useOutlinerUsers();

  const { stats, isLoading } = useDashboardStats({
    userId: selectedUserId || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
  });

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
  
    <>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label htmlFor="user-filter" className="text-sm font-medium text-gray-700 mb-1">
              Annotator
            </label>
            <select
              id="user-filter"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[180px]"
              disabled={usersLoading}
            >
              <option value="">All Users</option>
              {outlinerUsers.map((u: { id: string; name: string | null }) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="start-date" className="text-sm font-medium text-gray-700 mb-1">
              From
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="end-date" className="text-sm font-medium text-gray-700 mb-1">
              To
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <OverviewTab stats={stats ?? null} isLoading={isLoading} />
        </>
    
  );
}

export default OutlinerAdminDashboard;
