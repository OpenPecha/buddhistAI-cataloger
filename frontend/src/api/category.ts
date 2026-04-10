import {
  normalizeOpenpechaCategoryList,
  type NormalizedCategory,
} from '@/utils/normalizeOpenpechaCategories';

type Category = NormalizedCategory;

interface FetchCategoriesOptions {
  application?: string;
  language?: string;
  parent_id?: string | null;
}

const API_URL = '/api';

export const fetchCategories = async (options: FetchCategoriesOptions = {}): Promise<Category[]> => {
  const { application = 'webuddhist', language = 'bo', parent_id } = options;

  const queryParams = new URLSearchParams();
  queryParams.append('application', application);
  queryParams.append('language', language);
  if (parent_id) {
    queryParams.append('parent_id', parent_id);
  }

  const response = await fetch(
    `${API_URL}/v2/categories?${queryParams.toString()}`,
    {
      headers: {
        'accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  return normalizeOpenpechaCategoryList(data, language);
};


interface CreateCategoryPayload {
  application: string;
  title: Record<string, string>;
  parent?: string | null;
}


export const createCategory = async (
  payload: CreateCategoryPayload
): Promise<Category> => {
  const response = await fetch(`${API_URL}/v2/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create category: ${response.status} ${response.statusText} - ${err}`);
  }

  return response.json();
};


