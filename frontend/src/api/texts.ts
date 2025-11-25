
import { API_URL } from '@/config/api';
import type { OpenPechaText, OpenPechaTextInstance, OpenPechaTextInstanceListItem, CreateInstanceResponse } from '@/types/text';

// Helper function to handle API responses with better error messages
const handleApiResponse = async (response: Response, customMessages?: { 400?: string; 404?: string; 500?: string }) => {
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get('content-type');
    let errorMessage = '';

    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        let rawMessage = errorData.detail || errorData.details || errorData.message || errorData.error;
        
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
export const fetchTexts = async (params?: { limit?: number; offset?: number; language?: string; author?: string; type?: string }): Promise<OpenPechaText[]> => {
  const queryParams = new URLSearchParams();
  
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.language) queryParams.append('language', params.language);
  if (params?.author) queryParams.append('author', params.author);
  if (params?.type) queryParams.append('type', params.type);
  
  const queryString = queryParams.toString();
  const url = queryString ? `${API_URL}/text?${queryString}` : `${API_URL}/text`;
  
  try {
    const response = await fetch(url);
    const data = await handleApiResponse(response);
    return data.results || data || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load texts. Please check your connection and try again.');
  }
};

export const fetchText = async (id: string): Promise<OpenPechaText> => {
  try {
    const response = await fetch(`${API_URL}/text/${id}`);
    return await handleApiResponse(response, {
      404: 'Text not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load text details. Please check your connection and try again.');
  }
};

export const fetchTextsByTitle = async (title: string, signal?: AbortSignal): Promise<OpenPechaText[]> => {
  try {
    const response = await fetch(`${API_URL}/text/title-search?title=${title}`, {
      signal,
    });
    return await handleApiResponse(response);
  } catch (error) {
    // Re-throw AbortError - React Query handles this gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    // Re-throw other errors
    if (error instanceof Error) {
      throw error;
    }
    // Fallback for unknown errors
    throw new Error('Unable to search texts. Please check your connection and try again.');
  }
};


// Real API function for creating texts
export const createText = async (textData: any): Promise<OpenPechaText> => {
  try {
    const response = await fetch(`${API_URL}/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(textData),
    });

    return await handleApiResponse(response, {
      400: 'Invalid text data. Please check all required fields and try again.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to create text. Please check your connection and try again.');
  }
};

export const fetchTextInstances = async (id: string): Promise<OpenPechaTextInstanceListItem[]> => {
  try {
    const response = await fetch(`${API_URL}/text/${id}/instances`);
    return await handleApiResponse(response, {
      404: 'Text instances not found. The text may not exist or has no instances yet.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load text instances. Please check your connection and try again.');
  }
};

export const fetchInstance = async (id: string): Promise<OpenPechaTextInstance> => {
  try {
    const response = await fetch(`${API_URL}/text/instances/${id}`);
    return await handleApiResponse(response, {
      404: 'Instance not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load instance details. Please check your connection and try again.');
  }
};

// Real API function for creating text instances
export const createTextInstance = async (textId: string, instanceData: any, user: string): Promise<CreateInstanceResponse> => {
  try {
    const response = await fetch(`${API_URL}/text/${textId}/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...instanceData, user }),
    });

    return await handleApiResponse(response, {
      400: 'Invalid instance data. Please check all required fields and try again.',
      404: 'Text not found. Cannot create instance for non-existent text.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to create text instance. Please check your connection and try again.');
  }
};

export const fetchAnnotation = async (id: string): Promise<OpenPechaTextInstance> => {
  try {
    const response = await fetch(`${API_URL}/v2/annotations/${id}`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load annotation details. Please check your connection and try again.');
  }
};

export const fetchTextByBdrcId = async (bdrcId: string): Promise<OpenPechaText | null> => {
  try {
    const response = await fetch(`${API_URL}/text/${bdrcId}`);
    return await handleApiResponse(response);
  } catch {
    // Return null if not found (404) or any other error
    return null;
  }
};

export const fetchBdrcWorkInstance = async (workId: string, instanceId: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/bdrc/work/${workId}/instances/${instanceId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch BDRC work instance: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching BDRC work instance:", error);
    throw error;
  }
};

export const createTranslation = async (instanceId: string, translationData: any, user: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/instances/${instanceId}/translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...translationData, user }),
    });
    
    // Let handleApiResponse extract and show the actual backend error message
    return await handleApiResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to create translation. Please check your connection and try again.');
  }
};

export const createCommentary = async (instanceId: string, commentaryData: any, user: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/instances/${instanceId}/commentary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...commentaryData, user }),
    });
    
    // Let handleApiResponse extract and show the actual backend error message
    return await handleApiResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to create commentary. Please check your connection and try again.');
  }
};

export const updateAnnotation = async (annotationId: string, annotationData: any): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/v2/annotations/${annotationId}/annotation`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(annotationData),
    });
    
    return await handleApiResponse(response, {
      400: 'Invalid annotation data. Please check your segmentation and try again.',
      404: 'Annotation not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to update annotation. Please check your connection and try again.');
  }
};

export const updateInstance = async (textId: string, instanceId: string, instanceData: any): Promise<any> => {
  try {
    
    if (instanceData.biblography_annotation.length===0) {
      delete instanceData.biblography_annotation;
    }
    
    const response = await fetch(`${API_URL}/text/instances/${instanceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...instanceData }),
    });
    
    return await handleApiResponse(response, {
      400: 'Invalid instance data. Please check all required fields and try again.',
      404: 'Instance not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to update instance. Please check your connection and try again.');
  }
};


export const fetchEnums = async (type: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/v2/enum?type=${type}`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
};

export const fetchRelatedInstances = async (instanceId: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_URL}/instances/${instanceId}/related`);
    return await handleApiResponse(response, {
      404: 'Related instances not found. The instance may not exist or has no related instances.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load related instances. Please check your connection and try again.');
  }
};