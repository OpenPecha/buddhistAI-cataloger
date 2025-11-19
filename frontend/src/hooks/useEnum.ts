import { useQuery } from '@tanstack/react-query';
import { fetchEnums } from '@/api/texts';

export const useLanguage = () => {
  return useQuery({
    queryKey: ['enums', 'language'],
    queryFn: () => fetchEnums('language'),
    select: (original) => {
      return original.items
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};


export const useRole = () => {
  return useQuery({
    queryKey: ['enums', 'role'],
    queryFn: () => fetchEnums('role'),
    select: (original) => {
      return original.items
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};