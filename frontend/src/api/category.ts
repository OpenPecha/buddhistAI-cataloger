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


