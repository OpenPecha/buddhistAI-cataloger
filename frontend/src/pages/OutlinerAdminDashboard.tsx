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
      <div className=" bg-gray-50/80 px-3 py-2 mb-4 flex flex-wrap items-center gap-3 float-right">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filters</span>
        <select
          id="user-filter"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="border border-gray-300 px-2.5 py-1.5 text-sm min-w-[140px] bg-white"
          disabled={usersLoading}
          aria-label="Annotator"
        >
          <option value="">All users</option>
          {outlinerUsers.map((u: { id: string; name: string | null }) => (
            <option key={u.id} value={u.id}>
              {u.name || u.id}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="start-date">From</label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 px-2.5 py-1.5 text-sm bg-white"
        />
        <span className="text-gray-400 text-sm">–</span>
        <label className="sr-only" htmlFor="end-date">To</label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 px-2.5 py-1.5 text-sm bg-white"
        />
      </div>

      <OverviewTab stats={stats ?? null} isLoading={isLoading} />
    </>
  );
}

export default OutlinerAdminDashboard;
