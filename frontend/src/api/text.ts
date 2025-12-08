
const API_URL = '/api';
import type { OpenPechaText, OpenPechaTextInstance, Annotations } from '../types/text';


// Helper function to handle API responses with better error messages
const handleApiResponse = async (response: Response, customMessages?: { 400?: string; 404?: string; 500?: string }) => {
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get('content-type');
    let errorMessage = '';

    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        const rawMessage = errorData.detail || errorData.details || errorData.message || errorData.error;
        
        // If detail is a JSON string, parse it to extract the actual error message
        // Format: detail = "{\"error\":\"Translation must have a different language...\"}"
        if (rawMessage && typeof rawMessage === 'string') {
          const trimmedMessage = rawMessage.trim();
          
          // Try to parse as JSON if it looks like a JSON string
          try {
            const parsed = JSON.parse(trimmedMessage);
            if (parsed.error) {
              errorMessage = parsed.error;
            } else if (parsed.detail) {
              // Nested detail field
              try {
                const nestedParsed = JSON.parse(parsed.detail.trim());
                errorMessage = nestedParsed.error || parsed.detail.trim();
              } catch {
                errorMessage = parsed.detail.trim();
              }
            } else {
              errorMessage = trimmedMessage;
            }
          } catch {
            // If parsing fails, use the raw message as is
            errorMessage = trimmedMessage;
          }
        } else {
          errorMessage = rawMessage || '';
        }
      } catch {
        // If JSON parsing fails, ignore and use default message
      }
    }

    // Use backend error message if available, otherwise fall back to custom messages or defaults
    switch (response.status) {
      case 404:
        throw new Error(errorMessage || customMessages?.['404'] || 'The requested resource was not found. It may have been deleted or the link is incorrect.');
      case 500:
      case 502:
      case 503:
        throw new Error(errorMessage || customMessages?.['500'] || 'The server is experiencing issues. Please try again later.');
      case 400:
        throw new Error(errorMessage || customMessages?.['400'] || 'Invalid request. Please check your data and try again.');
      case 401:
        throw new Error(errorMessage || 'You are not authorized to access this resource.');
      case 403:
        throw new Error(errorMessage || 'Access to this resource is forbidden.');
      default:
        throw new Error(errorMessage || `An error occurred while connecting to the server (Error ${response.status}).`);
    }
  }

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    throw new Error('The server returned an invalid response. Please contact support if this persists.');
  }
};


// Real API function for Texts
export const fetchTexts = async (params?: { limit?: number; offset?: number; language?: string; author?: string }): Promise<OpenPechaText[]> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.language) queryParams.append('language', params.language);
  if (params?.author) queryParams.append('author', params.author);
  
  const queryString = queryParams.toString();
  const url = queryString ? `${API_URL}/text?${queryString}` : `${API_URL}/text?limit=20`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data.results || data || [];
};
export const fetchText = async (id: string): Promise<OpenPechaText> => {
  const response = await fetch(`${API_URL}/text/${id}`);
  return response.json();
};

// Real API function for creating texts
export const createText = async (textData: {
  type: string;
  title: { [key: string]: string };
  language: string;
  contributions?: Array<{ person_id: string; role: string }>;
  date?: string;
  bdrc?: string;
  alt_titles?: Array<{ [key: string]: string }>;
}): Promise<OpenPechaText> => {
  const response = await fetch(`${API_URL}/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(textData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const fetchTextInstances = async (id: string): Promise<OpenPechaTextInstance[]> => {
  const response = await fetch(`${API_URL}/text/${id}/instances`);
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
};

export const fetchInstance = async (id: string): Promise<OpenPechaTextInstance> => {
  const response = await fetch(`${API_URL}/text/instances/${id}?annotations=true`);
  return response.json();
};

export const fetchAnnotation = async (id: string): Promise<Annotations> => {
  const response = await fetch(`${API_URL}/v2/annotations/${id}`);
  return response.json();
};

export const createAnnotation = async (
  inferenceId: string,
  annotationData: {
    type: string;
    target_manifestation_id: string;
    target_annotation: Array<{
      span: {
        start: number;
        end: number;
      };
      index: number;
    }>;
    alignment_annotation: Array<{
      span: {
        start: number;
        end: number;
      };
      index: number;
      alignment_index: number[];
    }>;
  }
): Promise<Annotations> => {
  const response = await fetch(`${API_URL}/v2/annotations/${inferenceId}/annotation`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotationData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// API function for creating table of contents annotation
// Uses the same endpoint pattern as createAnnotation but for table_of_contents type
export const createTableOfContentsAnnotation = async (
  instanceId: string,
  annotationData: {
    type: string;
    annotation: Array<{
      title: string;
      segments: string[];
    }>;
  }
): Promise<Annotations> => {
  const response = await fetch(`${API_URL}/v2/annotations/${instanceId}/annotation`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotationData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Response type for title search
export interface TextTitleSearchResult {
  id: string;
  title: { [key: string]: string };
  instance_id: string;
}

export const fetchTextsByTitle = async (title: string): Promise<TextTitleSearchResult[]> => {
  try {
    const response = await fetch(`${API_URL}/text/title-search?title=${title}`);
    return await handleApiResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return [];
  }
};


// Real API function for creating text instances
export const createTextInstance = async (textId: string, instanceData: {
  metadata?: {
    type?: string;
    copyright?: string;
    bdrc?: string;
    colophon?: string;
    incipit_title?: { [key: string]: string };
  };
  annotation?: Array<{
    span: { start: number; end: number };
    index: number;
    alignment_index: number[];
  }>;
  content: string;
}): Promise<OpenPechaTextInstance> => {
  const response = await fetch(`${API_URL}/text/${textId}/instances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(instanceData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};




// API function for creating commentary for a specific instance
export const createCommentary = async (instanceId: string, commentaryData: {
  language: string;
  content: string;
  title: string;
  author: {
    person_bdrc_id: string;
  };
  category_id: string;
  segmentation?: Array<{
    span: {
      start: number;
      end: number;
    };
  }>;
  target_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
  }>;
  alignment_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
    alignment_index: number[];
  }>;
  copyright: string;
}): Promise<{
  text_id: string;
  instance_id: string;
  segmentation_annotation_id?: string;
  target_annotation_id?: string;
  alignment_annotation_id?: string;
}> => {
  const response = await fetch(`${API_URL}/instances/${instanceId}/commentary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commentaryData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// API function for creating translation for a specific instance
export const createTranslation = async (instanceId: string, translationData: {
  language: string;
  content: string;
  title: string;
  author: {
    person_bdrc_id: string;
  };
  category_id: string;
  segmentation?: Array<{
    span: {
      start: number;
      end: number;
    };
  }>;
  target_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
  }>;
  alignment_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
    alignment_index: number[];
  }>;
  copyright: string;
}): Promise<{
  text_id: string;
  instance_id: string;
  segmentation_annotation_id?: string;
  target_annotation_id?: string;
  alignment_annotation_id?: string;
}> => {
  const response = await fetch(`${API_URL}/instances/${instanceId}/translation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(translationData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};


// Inference API function for alignment analysis
export const fetchAlignmentInference = async (textId: string): Promise<{
  alignment_details: Array<{
    segment_id: string;
    alignment_score: number;
    aligned_segments: Array<{
      text: string;
      confidence: number;
      source: string;
    }>;
    metadata: {
      algorithm: string;
      timestamp: string;
    };
  }>;
  summary: {
    total_segments: number;
    aligned_segments: number;
    average_confidence: number;
  };
}> => {
  const response = await fetch(`${API_URL}/inference/alignment/${textId}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
};


// API function for cleaning annotations
export const cleanAnnotation = async (data: {
  text: string;
  sample_text: string;
}): Promise<any> => {
  const response = await fetch(`${API_URL}/v2/annotations/clean-annotation`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const updateAnnotation = async (annotationId: string, annotationData: {
  type?: string;
  target_manifestation_id?: string;
  target_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
  }>;
  alignment_annotation?: Array<{
    span: {
      start: number;
      end: number;
    };
    index: number;
    alignment_index: number[];
  }>;
  content?: string;
}): Promise<Annotations> => {
  // Transform the data to match the expected schema
  const requestBody = {
    type: annotationData.type,
    data: {
      alignment_annotation: annotationData.alignment_annotation,
      target_annotation: annotationData.target_annotation
    }
  };

  const response = await fetch(`${API_URL}/v2/annotations/${annotationId}/annotation`, {
    method: 'PUT',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};