import { useQuery } from '@tanstack/react-query';
import { fetchLanguage } from '@/api/language';
import { fetchRole } from '@/api/role';

export const useLanguage = () => {
  return useQuery({
    queryKey: ['language', 'list'],
    queryFn: () => fetchLanguage(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};


export const useRole = () => {
  return useQuery({
    queryKey: ['role', 'list'],
    queryFn: () => fetchRole(),
    select: (original) => {
      return original.items
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
