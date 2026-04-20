
import type { RelatedInstance } from '@/types/text';

const API_URL = '/api';


export const fetchRelatedInstances = async (editionId: string): Promise<RelatedInstance[]> => {
  const response = await fetch(
    `${API_URL}/editions/${editionId}/related`,
    {
      headers: {
        'accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch related editions: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Ensure we return an array
  if (Array.isArray(data)) {
    return data;
  } else if (data && typeof data === 'object') {
    // If it's a single object, wrap it in an array
    return [data];
  } else {
    // If no data or invalid format, return empty array
    return [];
  }
};

