import { fetchPermission } from '@/api/permissions';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';

export const usePermission = () => {

  const { user} = useAuth0();
  return useQuery({
    queryKey: ['enums', "user","permission"],
    queryFn: () => fetchPermission(user.email),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled:!!user?.email
  });
};