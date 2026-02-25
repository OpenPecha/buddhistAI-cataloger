import type { User } from '@/api/user';
import UserRow from './UserRow';

interface UsersTabProps {
  users: User[];
  onUserUpdate: (userId: string, userData: { role?: string; permissions?: string[] }) => void;
  onUserDelete: (userId: string) => void;
  total: number;
  skip: number;
  limit: number;
  onPageChange: (newSkip: number) => void;
}

function UsersTab({
  users,
  onUserUpdate,
  onUserDelete,
  total,
  skip,
  limit,
  onPageChange
}: UsersTabProps) {
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = skip + limit < total;
  const hasPrevPage = skip > 0;

  const handleNextPage = () => {
    if (hasNextPage) {
      onPageChange(skip + limit);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      onPageChange(Math.max(0, skip - limit));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">User Management</h3>
              <p className="text-gray-600 mt-1">Manage user roles and permissions</p>
            </div>
            <div className="text-sm text-gray-600">
              Showing {skip + 1}-{Math.min(skip + limit, total)} of {total} users
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onUpdate={onUserUpdate}
                    onDelete={onUserDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={!hasPrevPage}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!hasNextPage}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersTab;
