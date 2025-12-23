interface Category {
  id: string;
  parent: string | null;
  title: string;
  has_child: boolean;
}

interface FetchCategoriesOptions {
  application?: string;
  language?: string;
}

const API_URL = '/api';

export const fetchCategories = async (options: FetchCategoriesOptions = {}): Promise<Category[]> => {
  const { application = 'webuddhist', language = 'bo' } = options;
  
  const queryParams = new URLSearchParams();
  queryParams.append('application', application);
  queryParams.append('language', language);
  
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

  return response.json();
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


