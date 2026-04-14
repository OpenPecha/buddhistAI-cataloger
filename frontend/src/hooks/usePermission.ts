import { fetchPermission } from '@/api/permissions';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';

export const usePermission = () => {
  const { isAuthenticated } = useAuth0();
  return useQuery({
    queryKey: ['enums', 'user', 'permission'],
    queryFn: () => fetchPermission(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAuthenticated,
  });
};