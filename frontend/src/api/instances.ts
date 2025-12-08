
interface RelatedInstance {
  // Support both API response formats
  id?: string;
  instance_id?: string;
  type?: string;
  incipit_title?: Record<string, string>;
  alt_incipit_titles?: Record<string, string>;
  content?: string;
  annotations?: Array<{
    annotation_id: string;
    type: string;
  }>;
  // New API response format
  metadata?: {
    instance_type?: string;
    copyright?: string;
    text_id?: string;
    title?: Record<string, string>;
    alt_titles?: Array<Record<string, string>>;
    language?: string;
    contributions?: Array<{
      person_id: string;
      role: string;
    }>;
  };
  annotation?: string;
  relationship?: string;
}

const API_URL = '/api';


export const fetchRelatedInstances = async (instanceId: string): Promise<RelatedInstance[]> => {
  const response = await fetch(
    `${API_URL}/instances/${instanceId}/related`,
    {
      headers: {
        'accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch related instances: ${response.status} ${response.statusText}`);
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


