import type { User } from '@/api/user';
import UserRow from './UserRow';

interface UsersTabProps {
  users: User[];
  onUserUpdate: (userId: string, userData: { role?: string; permissions?: string[] }) => void;
  onUserDelete: (userId: string) => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
}

function UsersTab({
  users,
  onUserUpdate,
  onUserDelete,
  roleFilter,
  onRoleFilterChange
}: UsersTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">User Management</h3>
              <p className="text-gray-600 mt-1">Manage user roles and permissions</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={roleFilter}
                onChange={(e) => onRoleFilterChange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Roles</option>
                <option value="annotator">Annotator</option>
                <option value="reviewer">Reviewer</option>
              </select>
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
      </div>
    </div>
  );
}

export default UsersTab;
