import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

export interface Category {
  id: string;
  parent: string | null;
  title: string;
  has_child: boolean;
}

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Fetch function for categories
const fetchCategories = async (parentId: string | null): Promise<Category[]> => {
  const params = new URLSearchParams();
  params.append('application', 'webuddhist');
  params.append('language', 'bo');
  if (parentId) {
    params.append('parent_id', parentId);
  }

  const url = `${API_URL}/v2/categories?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return response.json();
};

export const useCategories = (parentId: string | null = null): UseCategoriesResult => {
  const {
    data: categories = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['categories', parentId || 'root'],
    queryFn: () => fetchCategories(parentId),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
  });

  return {
    categories,
    loading,
    error: error ? (error as Error).message : null,
    refetch: () => {
      refetch();
    },
  };
};

