import { useAuth0 } from '@auth0/auth0-react';
import { usePermission } from '@/hooks/usePermission';
import { Loader2 } from 'lucide-react';

function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth0();
  const { data: permission, isLoading: isPermissionLoading } = usePermission();

  const isLoading = isAuthLoading || isPermissionLoading;
  const isAdmin = permission?.role === 'admin';

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 max-w-xl">
        <div className="bg-white rounded-lg shadow-md px-8 py-8 flex flex-col gap-6 items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-16 max-w-xl">
        <div className="bg-white rounded-lg shadow-md px-8 py-8 flex flex-col gap-6 items-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">User Profile</h2>
          <p className="text-gray-500">No user data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-16 max-w-xl">
      <div className="bg-white rounded-lg shadow-md px-8 py-8 flex flex-col gap-6 items-center">
        <h2 className="text-2xl font-bold text-gray-700 mb-2">User Profile</h2>
        <div className="w-full">
          <div className="mb-4">
            <span className="block text-gray-500 font-semibold">Name</span>
            <span className="block text-lg font-medium text-gray-900">
              {user.name || user.nickname || 'N/A'}
            </span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-500 font-semibold">Email</span>
            <span className="block text-lg font-medium text-gray-900">
              {user.email || 'N/A'}
            </span>
          </div>
          <div className="mb-2">
            <span className="block text-gray-500 font-semibold mb-2">Role</span>
            <div className="flex items-center gap-3">
              <span
                className={`inline-block px-3 py-1 rounded text-md font-medium ${
                  isAdmin
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isAdmin ? 'Admin' : 'Not Admin'}
              </span>
              {permission?.role && (
                <span className="text-sm text-gray-500">
                  ({permission.role})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
