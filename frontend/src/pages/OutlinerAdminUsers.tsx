import { useState } from 'react';
import { UsersTab } from '../components/admin';
import { SimplePagination } from '../components/ui/simple-pagination';
import { useUsers, useUserActions } from '../hooks';
import { SkeletonLarger } from '@/components/ui/skeleton';

function OutlinerAdminUsers() {
  const [skip, setSkip] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const limit = 20;
  const { users, total, isLoading } = useUsers({ skip, limit, role: roleFilter || undefined });
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

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setSkip(0);
  };

  const canGoPrev = skip > 0;
  const canGoNext = skip + limit < total;
  const onPrev = () => setSkip(Math.max(0, skip - limit));
  const onNext = () => setSkip(skip + limit);
  const rangeLabel =
    total === 0
      ? '0 users'
      : `Showing ${skip + 1}-${Math.min(skip + limit, total)} of ${total} users`;

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col">
      <SkeletonLarger />
    </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <UsersTab
        users={users}
        onUserUpdate={handleUserUpdate}
        onUserDelete={handleUserDelete}
        roleFilter={roleFilter}
        onRoleFilterChange={handleRoleFilterChange}
      />
      {total > limit && (
        <SimplePagination
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={onPrev}
          onNext={onNext}
          label={rangeLabel}
        />
      )}
    </div>
  );
}

export default OutlinerAdminUsers;
