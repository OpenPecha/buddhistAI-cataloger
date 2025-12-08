import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api/category';

export interface Category {
  id: string;
  parent: string | null;
  title: string;
  has_child: boolean;
}

interface UseCategoriesOptions {
  application?: string;
  language?: string;
}

export const useCategories = (
  parentId: string | null = null,
  options: UseCategoriesOptions = {}
) => {
  const { application = 'webuddhist', language = 'bo' } = options;
  
  const {
    data: allCategories = [],
    isLoading: loading,
    error,
    isError
  } = useQuery({
    queryKey: ['categories', application, language],
    queryFn: () => fetchCategories({ application, language }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Filter categories by parent ID
  const categories = allCategories.filter(category => category.parent === parentId);

  return {
    categories,
    loading,
    error: isError ? (error instanceof Error ? error.message : 'Failed to load categories') : null,
  };
};
