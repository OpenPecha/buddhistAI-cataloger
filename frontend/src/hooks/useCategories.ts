import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import {
  normalizeOpenpechaCategoryList,
  type NormalizedCategory,
} from '@/utils/normalizeOpenpechaCategories';

export type Category = NormalizedCategory;

interface UseCategoriesResult {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function queryErrorToMessage(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An error occurred';
}

// Fetch function for categories
const fetchCategories = async (parentId: string | null, language: string = 'bo'): Promise<Category[]> => {
  const params = new URLSearchParams();
  params.append('application', 'webuddhist');
  params.append('language', language);
  if (parentId) {
    params.append('parent_id', parentId);
  }

  const url = `${API_URL}/v2/categories?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  return normalizeOpenpechaCategoryList(data, language);
};

export const useCategories = (parentId: string | null = null): UseCategoriesResult => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const {
    data: categories = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['categories', parentId || 'root', language],
    queryFn: () => fetchCategories(parentId, language),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
  });

  return {
    categories,
    isLoading,
    error: queryErrorToMessage(error),
    refetch: () => {
      refetch();
    },
  };
};

