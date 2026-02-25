import { useState } from 'react';
import { UsersTab } from '../components/admin';
import { useUsers, useUserActions } from '../hooks';

function OutlinerAdminUsers() {
  const [skip, setSkip] = useState(0);
  const limit = 20;
  const { users, total, isLoading } = useUsers({ skip, limit });
  const { updateUser, deleteUser } = useUserActions();

  const handleUserUpdate = async (
    userId: string,
    userData: { role?: string; permissions?: string[] }
  ) => {
    try {
      await updateUser(userId, userData);
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update user. Please try again.');
    }
  };

  const handleUserDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const handlePageChange = (newSkip: number) => {
    setSkip(newSkip);
  };

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

        <UsersTab
          users={users}
          onUserUpdate={handleUserUpdate}
          onUserDelete={handleUserDelete}
          total={total}
          skip={skip}
          limit={limit}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

export default OutlinerAdminUsers;
